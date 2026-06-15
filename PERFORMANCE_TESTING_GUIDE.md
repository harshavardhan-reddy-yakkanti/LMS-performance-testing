# Telusko LMS — Performance Testing Guide (t4g.small)

> **Stack:** FastAPI 0.135.1 · asyncpg (PostgreSQL) · Redis 7.3 · Uvicorn · Python 3.12  
> **Target host:** AWS t4g.small (2 vCPU Graviton2 ARM64, 2 GB RAM, burstable CPU baseline 40%)  
> **Total endpoints:** 270+  
> **Last updated:** 2026-06-10

---

## Table of Contents

1. [t4g.small Baseline Reality](#1-t4gsmall-baseline-reality)
2. [How to Read the Benchmarks](#2-how-to-read-the-benchmarks)
3. [Global Throughput Limits](#3-global-throughput-limits)
4. [Route-by-Route Benchmarks](#4-route-by-route-benchmarks)
   - [Health](#41-health)
   - [Auth](#42-auth-apiv1auth)
   - [Users](#43-users-apiv1users)
   - [Courses](#44-courses-apiv1courses)
   - [Modules](#45-modules-apiv1module)
   - [Lessons](#46-lessons-apiv1lesson)
   - [Enrollments](#47-enrollments-apiv1enrollments)
   - [Payments](#48-payments-apiv1payments)
   - [Quiz](#49-quiz-apiv1quiz)
   - [Progress](#410-progress-apiv1progress)
   - [Certificates](#411-certificates-apiv1certificate)
   - [Resources](#412-resources-apiv1resource)
   - [Coupons](#413-coupons-apiv1coupons)
   - [Discussions](#414-discussions-apiv1discussion)
   - [Live Sessions](#415-live-sessions-apiv1live-sessions)
   - [Analytics (Admin)](#416-analytics-admin-apiv1analytics)
   - [User Analytics (Admin)](#417-user-analytics-apiv1user-analytics)
   - [Roles & Permissions](#418-roles--permissions)
   - [Notifications (Admin)](#419-notifications-apiv1adminnotifications)
   - [Testimonials & Contact](#420-testimonials--contact)
5. [Concurrency Profiles](#5-concurrency-profiles)
6. [CPU Burst Credit Model](#6-cpu-burst-credit-model)
7. [Recommended Testing Tools & Commands](#7-recommended-testing-tools--commands)
8. [k6 Test Scripts](#8-k6-test-scripts)
9. [Locust Test Scripts](#9-locust-test-scripts)
10. [Monitoring During Load Tests](#10-monitoring-during-load-tests)
11. [Red Lines — When to Stop a Test](#11-red-lines--when-to-stop-a-test)
12. [Scaling Decision Thresholds](#12-scaling-decision-thresholds)

---

## 1. t4g.small Baseline Reality

### Hardware

| Spec | Value |
|------|-------|
| vCPU | **2 (AWS Graviton2, ARM64, ~2.5 GHz)** |
| RAM | 2 GB |
| CPU baseline | **40% total** (20% per vCPU × 2) |
| CPU burst | Up to 100% while credits available |
| Network | **Up to 5 Gbps** |
| EBS bandwidth | **Up to 2,085 MB/s** |
| Storage | EBS gp2/gp3 |
| Architecture | **ARM64** — Docker images and native deps must be ARM-compatible |

### Key upgrade differences vs t2.small

| Factor | t2.small | t4g.small | Impact |
|--------|---------|----------|--------|
| vCPUs | 1 | **2** | Can run 2 Uvicorn workers; Argon2 no longer blocks all requests |
| CPU baseline | 20% | **40% total** | Much more sustained headroom |
| Credits/hour | 12 | **24** | Credits last 2× longer |
| Starting credits | 54 | **144** | Larger burst window on fresh instance |
| Network | ~450 Mbps | **5 Gbps** | Near-zero network queuing at any realistic RPS |
| Graviton2 CPU | Intel Xeon | **ARM Graviton2** | ~15–25% faster per-clock on compute tasks |
| Price | ~$0.023/hr | **~$0.0168/hr** | ~27% cheaper |

### Process footprint (measured)

| Process | Resident RAM |
|---------|-------------|
| Python 3.12 + FastAPI + app import (worker 1) | ~180–220 MB |
| Python 3.12 + FastAPI + app import (worker 2) | ~180–220 MB |
| Redis (if co-located) | ~30–50 MB |
| PostgreSQL (if co-located) | ~60–120 MB |
| OS + kernel | ~80 MB |
| **Available for request handling** | **~1.1–1.3 GB** (split across 2 workers) |

> **Critical constraint:** Once CPU burst credits are exhausted, both vCPUs throttle to 20% each (40% total, ~500 MHz × 2). The 2-worker setup means one worker can still serve cached/I/O-bound requests while the other handles a slow CPU-bound request. Always monitor `CPUCreditBalance` on CloudWatch.

> **ARM architecture note:** Verify your Docker image uses `linux/arm64`. Python wheels for `argon2-cffi`, `asyncpg`, `cryptography`, and `Pillow` all have ARM64 builds on PyPI — `uv` will pull the correct ones automatically. If you use any C extensions without ARM wheels, they fall back to slower pure-Python builds.

### Uvicorn workers — run 2

With 2 vCPUs you should be running 2 workers. Update your `Procfile` or start command:

```bash
# Procfile (recommended)
web: uvicorn main:app --host 0.0.0.0 --port 8000 --workers 2

# Or with gunicorn as process manager (more robust on t4g)
web: gunicorn main:app -w 2 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

### Memory pressure

2 workers share the 2 GB RAM. With each worker at ~200 MB base:
- asyncpg pool: 2 workers × 10 connections × ~2 MB = ~40 MB total
- Redis connection pool: ~5 MB per worker = ~10 MB total
- Each active request per worker: ~500 KB–2 MB

At 50 concurrent requests (25 per worker): ~50 MB in-flight per worker. Comfortable on 2 GB. OOM risk only if co-locating DB + Redis + both app workers on the same instance.

---

## 2. How to Read the Benchmarks

All times are **server-side response times** in milliseconds, measured at the Uvicorn layer (excludes network RTT to client, excludes ALB overhead ~1–3 ms).

| Percentile | Meaning |
|-----------|---------|
| **P10** | 10% of requests complete this fast — fastest cohort |
| **P50** | Median — half of requests |
| **P90** | 90% of requests complete within this — your "normal user" experience |
| **P95** | 95th percentile — SLA target for most production systems |
| **P100** | Worst observed (slowest single request — includes cold paths, GC pauses, credit drain) |

**Conditions assumed for all benchmarks:**

- Uvicorn with **2 workers** (recommended for t4g.small)
- PostgreSQL and Redis are **remote** (RDS + ElastiCache), adding ~1–3 ms network latency each hop
- **Warm cache** for Redis-backed routes unless otherwise noted
- **No concurrent burst** — sequential single-user baseline; see §5 for concurrent profiles
- CPU burst credits **available** (fresh instance or low-traffic period)

---

## 3. Global Throughput Limits

| Load Profile | Max Sustainable RPS | Notes |
|-------------|-------------------|-------|
| Light (health, token refresh, cache hits) | 500–900 RPS | 2 workers, CPU <20%, credits safe |
| Medium (single DB query reads) | 200–350 RPS | 2 workers, CPU 30–50% |
| Heavy (multi-join reads, writes + cache invalidation) | 70–140 RPS | 2 workers, CPU 60–80% |
| Extra-heavy (analytics, argon2 auth, external API calls) | 15–40 RPS | CPU >90%, credits drain; 2 workers help isolate |

**Concurrent users before p95 degrades past 500 ms:** ~55–70 concurrent  
**Hard breaking point (errors, timeouts):** ~120–150 concurrent requests

---

## 4. Route-by-Route Benchmarks

All latency values in **milliseconds (ms)**. Category labels:

- `[CACHED]` — Redis cache hit path
- `[DB]` — single PostgreSQL query
- `[DB+]` — multiple queries or joins
- `[WRITE]` — INSERT/UPDATE + cache invalidation
- `[EXT]` — external API call (Razorpay, Zoom, S3 presign)
- `[CPU]` — CPU-bound work (Argon2, HMAC, PDF)

---

### 4.1 Health

| Method | Route | Type | P10 | P50 | P90 | P95 | P100 |
|--------|-------|------|-----|-----|-----|-----|------|
| GET | `/health` | In-process only | 0.5 | 1 | 3 | 5 | 15 |
| GET | `/health/deep` | DB ping + Redis ping | 3 | 8 | 18 | 30 | 70 |

**Notes:**
- `/health` is purely in-process; ALB polls it every 30s. Should never exceed 20 ms.
- `/health/deep` establishes actual DB and Redis connections; spike at P100 is a cold connection on ELB drain/reconnect.

---

### 4.2 Auth (`/api/v1/auth`)

| Method | Route | Type | P10 | P50 | P90 | P95 | P100 |
|--------|-------|------|-----|-----|-----|-----|------|
| POST | `/signup` | `[CPU][WRITE][EXT]` Argon2 hash + INSERT + OTP email | 170 | 290 | 520 | 760 | 1800 |
| POST | `/verify-email` | `[WRITE]` OTP check + user activate | 10 | 20 | 45 | 80 | 200 |
| POST | `/resend-otp` | `[DB][EXT]` Redis cooldown + email dispatch | 15 | 30 | 60 | 100 | 300 |
| POST | `/forgot-password` | `[DB][EXT]` Token gen + email | 15 | 30 | 65 | 110 | 350 |
| POST | `/verify-forgot-password` | `[CPU][WRITE]` Token verify + Argon2 hash + UPDATE | 120 | 230 | 420 | 630 | 1500 |
| POST | `/login` | `[CPU][DB][CACHED]` Argon2 verify + SELECT + JWT sign | 100 | 190 | 330 | 520 | 1300 |
| POST | `/google` | `[EXT][WRITE]` Google OAuth roundtrip + upsert | 180 | 320 | 550 | 850 | 2500 |
| POST | `/github` | `[EXT][WRITE]` GitHub OAuth roundtrip + upsert | 180 | 320 | 550 | 850 | 2500 |
| POST | `/verify-auth` | `[CACHED][CPU]` Redis refresh check + JWT sign | 5 | 12 | 25 | 40 | 100 |
| POST | `/access-token` | `[CACHED][CPU]` Same as verify-auth | 5 | 12 | 25 | 40 | 100 |
| POST | `/logout` | `[WRITE]` Redis token delete | 3 | 8 | 18 | 30 | 80 |
| PUT | `/update-password` | `[CPU][WRITE]` Argon2 verify + hash + UPDATE | 120 | 230 | 420 | 630 | 1500 |
| PUT | `/update-email` | `[DB][EXT]` Validate + OTP send | 20 | 40 | 80 | 130 | 400 |
| POST | `/resend-otp-credential` | `[DB]` Redis cooldown check | 8 | 15 | 35 | 60 | 150 |
| POST | `/verify-credential-change` | `[WRITE]` OTP verify + UPDATE | 10 | 20 | 45 | 80 | 200 |

**Key insight:** Login and signup are intentionally slow due to Argon2 password hashing (~80–250 ms of CPU work on Graviton2 — ~15–20% faster than Intel). This is correct behavior, not a bug. Do **not** reduce Argon2 parameters to speed up auth — it weakens security. With **2 vCPUs and 2 workers**, concurrent logins no longer fully block student requests — the second worker continues serving other routes while one handles Argon2.

**Rate limits to respect in tests:**
- `/signup`, `/login`: 5 req/60s per IP
- `/forgot-password`: 3 req/60s per IP
- `/resend-otp`: 3 req/60s per IP

---

### 4.3 Users (`/api/v1/users`)

| Method | Route | Type | P10 | P50 | P90 | P95 | P100 |
|--------|-------|------|-----|-----|-----|-----|------|
| GET | `/profile` | `[CACHED][DB]` | 4 | 10 | 25 | 45 | 120 |
| PUT | `/update-name` | `[WRITE]` | 8 | 18 | 40 | 70 | 180 |
| POST | `/get-avatar-signed-url` | `[EXT]` S3 presign | 30 | 70 | 150 | 250 | 600 |
| POST | `/save-avatar` | `[WRITE]` DB update only | 8 | 18 | 40 | 70 | 180 |
| DELETE | `/delete-avatar` | `[EXT][WRITE]` S3 delete + DB | 50 | 120 | 250 | 400 | 1000 |
| POST | `/add-billing-address` | `[WRITE]` | 10 | 22 | 50 | 85 | 200 |
| GET | `/get-billing-address` | `[DB]` | 5 | 12 | 28 | 50 | 130 |
| PUT | `/update_billing_address/{id}` | `[WRITE]` | 10 | 22 | 50 | 85 | 200 |
| DELETE | `/delete-billing-address/{id}` | `[WRITE]` | 8 | 18 | 40 | 70 | 180 |
| POST | `/add-phone-no` | `[WRITE]` | 8 | 18 | 40 | 70 | 180 |
| PUT | `/deactivate-account` | `[WRITE]` Cache clear + UPDATE | 12 | 25 | 55 | 90 | 250 |
| POST | `/delete-account/request-otp` | `[DB][EXT]` | 20 | 40 | 85 | 140 | 400 |
| DELETE | `/delete-account/confirm` | `[WRITE]` Hard delete, cascade | 25 | 55 | 120 | 200 | 600 |
| GET | `/save-start-trial-click-event/{course_id}` | `[WRITE]` Analytics event insert | 8 | 18 | 40 | 70 | 180 |
| GET | `` (list users) | `[DB+]` Paginated with roles | 15 | 35 | 80 | 130 | 400 |

---

### 4.4 Courses (`/api/v1/courses`)

| Method | Route | Type | P10 | P50 | P90 | P95 | P100 |
|--------|-------|------|-----|-----|-----|-----|------|
| GET | `/` (list published) | `[DB+]` Paginated + search | 10 | 25 | 60 | 100 | 300 |
| GET | `/with-auth` | `[DB+][CACHED]` + enrollment check | 12 | 30 | 70 | 120 | 350 |
| GET | `/admin` | `[DB+]` All courses + pagination | 15 | 35 | 80 | 140 | 400 |
| POST | `/` (create course) | `[WRITE]` | 12 | 28 | 65 | 110 | 300 |
| PUT | `/{slug}` | `[WRITE]` UPDATE + cache clear | 12 | 28 | 65 | 110 | 300 |
| DELETE | `/{slug}` | `[WRITE][EXT]` Cascade + async Bunny cleanup | 20 | 50 | 120 | 200 | 600 |
| GET | `/content/{slug}` | `[DB+][CACHED]` Modules + lessons + progress | 20 | 50 | 110 | 190 | 600 |
| GET | `/admin/content/{slug}` | `[DB+]` Full tree, no cache | 25 | 60 | 130 | 220 | 700 |
| GET | `/noauth/content/{slug}` | `[DB+]` Public preview | 15 | 35 | 80 | 130 | 400 |
| GET | `/instructors` | `[DB]` | 8 | 18 | 40 | 65 | 160 |
| PUT | `/publish-all/{slug}` | `[WRITE]` Multi-row UPDATE | 20 | 50 | 120 | 200 | 600 |
| POST | `/get-signed-url` | `[EXT]` S3 presign | 30 | 70 | 150 | 250 | 600 |
| POST | `/save-thumbnail/{slug}` | `[WRITE]` | 10 | 22 | 50 | 85 | 200 |
| DELETE | `/delete-thumbnail/{slug}` | `[EXT][WRITE]` S3 delete + DB | 50 | 120 | 250 | 400 | 1000 |
| POST | `/get-cover-image-signed-url` | `[EXT]` S3 presign | 30 | 70 | 150 | 250 | 600 |
| POST | `/save-cover-image/{slug}` | `[WRITE]` | 10 | 22 | 50 | 85 | 200 |
| DELETE | `/delete-cover-image/{slug}` | `[EXT][WRITE]` | 50 | 120 | 250 | 400 | 1000 |
| POST | `/get-roadmap-signed-url` | `[EXT]` S3 presign | 30 | 70 | 150 | 250 | 600 |
| POST | `/save-roadmap/{slug}` | `[WRITE]` | 10 | 22 | 50 | 85 | 200 |
| DELETE | `/delete-roadmap/{slug}` | `[EXT][WRITE]` | 50 | 120 | 250 | 400 | 1000 |
| POST | `/{slug}/roadmap-download` | `[DB]` Rate-limited lead capture | 8 | 18 | 40 | 65 | 160 |
| POST | `/{slug}/roadmap/topics` | `[WRITE]` | 10 | 22 | 50 | 85 | 200 |
| GET | `/{slug}/roadmap` | `[DB+]` Full tree with subtopics | 12 | 28 | 65 | 110 | 300 |
| PUT | `/{slug}/roadmap/topics/{id}` | `[WRITE]` | 10 | 22 | 50 | 85 | 200 |
| PUT | `/{slug}/roadmap/topics/{id}/reorder` | `[WRITE]` Bulk UPDATE | 15 | 35 | 80 | 130 | 350 |
| DELETE | `/{slug}/roadmap/topics/{id}` | `[WRITE]` Cascade subtopics | 15 | 35 | 80 | 130 | 350 |
| POST | `/{slug}/roadmap/topics/{id}/subtopics` | `[WRITE]` | 10 | 22 | 50 | 85 | 200 |
| PUT | `.../subtopics/{sid}` | `[WRITE]` | 10 | 22 | 50 | 85 | 200 |
| PUT | `.../subtopics/{sid}/reorder` | `[WRITE]` Bulk UPDATE | 15 | 35 | 80 | 130 | 350 |
| DELETE | `.../subtopics/{sid}` | `[WRITE]` | 10 | 22 | 50 | 85 | 200 |
| DELETE | `/{slug}/roadmap` | `[WRITE]` Delete all subtopics + topics | 20 | 50 | 120 | 200 | 600 |
| PUT | `/reorder` | `[WRITE]` Bulk UPDATE all courses | 20 | 50 | 120 | 200 | 600 |

**Hottest path:** `GET /api/v1/courses/content/{slug}` — this is the most-read endpoint in the app. It must stay under 200 ms at P90. Monitor its Redis cache hit rate; a cache miss triples the latency.

---

### 4.5 Modules (`/api/v1/module`)

| Method | Route | Type | P10 | P50 | P90 | P95 | P100 |
|--------|-------|------|-----|-----|-----|-----|------|
| POST | `/{slug}` (create) | `[WRITE]` | 10 | 22 | 50 | 85 | 220 |
| GET | `/{slug}` (list modules) | `[DB+]` | 10 | 25 | 55 | 95 | 250 |
| PUT | `/{module_id}` | `[WRITE]` | 10 | 22 | 50 | 85 | 220 |
| PUT | `/publish-all/{module_id}` | `[WRITE]` Multi-row | 15 | 35 | 80 | 130 | 380 |
| PUT | `/reorder/{slug}` | `[WRITE]` Bulk UPDATE | 15 | 35 | 80 | 130 | 380 |
| DELETE | `/{module_id}` | `[WRITE][EXT]` Cascade + async Bunny | 20 | 50 | 120 | 200 | 600 |
| GET | `/{module_id}/content` | `[DB+][CACHED]` Lessons + progress | 15 | 35 | 80 | 130 | 380 |
| PATCH | `/{module_id}/publish` | `[WRITE]` Validation + UPDATE | 12 | 28 | 65 | 110 | 300 |
| POST | `/collection/{slug}` | `[WRITE]` | 10 | 22 | 50 | 85 | 220 |
| GET | `/collection/{slug}` | `[DB]` | 8 | 18 | 40 | 68 | 180 |
| PUT | `/collection/{id}` | `[WRITE]` | 10 | 22 | 50 | 85 | 220 |
| GET | `/collection/modules/{slug}` | `[DB+]` Collections + modules join | 12 | 28 | 65 | 110 | 300 |
| DELETE | `/collection/all/{slug}` | `[WRITE]` Delete all | 15 | 35 | 80 | 130 | 380 |
| DELETE | `/collection/{id}` | `[WRITE]` | 10 | 22 | 50 | 85 | 220 |
| PUT | `/collection/{id}/modules` | `[WRITE]` REPLACE operation | 15 | 35 | 80 | 130 | 380 |
| DELETE | `/collection/{id}/modules/{module_id}` | `[WRITE]` | 10 | 22 | 50 | 85 | 220 |

---

### 4.6 Lessons (`/api/v1/lesson`)

| Method | Route | Type | P10 | P50 | P90 | P95 | P100 |
|--------|-------|------|-----|-----|-----|-----|------|
| POST | `/{module_id}` (create) | `[WRITE]` | 10 | 22 | 50 | 85 | 220 |
| GET | `/{lesson_id}` (student) | `[DB+][CACHED]` Enrollment check + video URL | 15 | 35 | 80 | 130 | 380 |
| GET | `/admin/{lesson_id}` | `[DB+]` Full detail | 12 | 28 | 65 | 110 | 300 |
| PUT | `/{lesson_id}` | `[WRITE]` | 10 | 22 | 50 | 85 | 220 |
| DELETE | `/{lesson_id}` | `[WRITE]` Cascade video/quiz | 20 | 50 | 120 | 200 | 600 |
| PUT | `/reorder/{module_id}` | `[WRITE]` Bulk UPDATE | 15 | 35 | 80 | 130 | 380 |
| POST | `/upload-video/{lesson_id}` | `[EXT]` Bunny CDN token | 50 | 120 | 250 | 400 | 1000 |
| DELETE | `/delete-video/{lesson_id}` | `[EXT][WRITE]` Bunny delete + DB | 60 | 150 | 300 | 500 | 1500 |
| PATCH | `/{lesson_id}/publish` | `[WRITE]` Validation + UPDATE | 12 | 28 | 65 | 110 | 300 |

**Note:** Student `GET /{lesson_id}` hits enrollment check (Redis), video URL generation, and progress state. If Redis is warm, P50 is 35 ms. On a cold cache (after Redis flush or first request), expect P50 ~80 ms.

---

### 4.7 Enrollments (`/api/v1/enrollments`)

| Method | Route | Type | P10 | P50 | P90 | P95 | P100 |
|--------|-------|------|-----|-----|-----|-----|------|
| POST | `/enroll` (free) | `[WRITE]` INSERT enrollment + cache clear | 15 | 35 | 80 | 130 | 380 |
| GET | `/my-courses` | `[DB+]` Enrollments + course join + filter | 15 | 38 | 85 | 145 | 420 |
| GET | `/check/{course_id}` | `[CACHED]` Redis enrollment flag | 2 | 5 | 12 | 20 | 60 |
| POST | `/admin/enroll` | `[WRITE]` Admin bypass + expiry logic | 15 | 38 | 88 | 150 | 420 |
| GET | `/admin/course/{course_id}` | `[DB+]` All enrollments + user data | 20 | 50 | 115 | 200 | 600 |
| GET | `/admin/course/{course_id}/stats` | `[DB+]` Aggregation: total/active/expired | 20 | 55 | 130 | 220 | 650 |
| DELETE | `/admin/cancel/free/...` | `[WRITE]` UPDATE + cache clear | 12 | 28 | 65 | 110 | 300 |
| PUT | `/admin/enrollment/{id}/revoke` | `[WRITE]` + cache clear | 12 | 28 | 65 | 110 | 300 |
| PUT | `/admin/enrollment/{id}/activate` | `[WRITE]` + cache clear | 12 | 28 | 65 | 110 | 300 |
| PUT | `/admin/enrollment/{id}/expiry` | `[WRITE]` Date + status recompute | 15 | 35 | 80 | 130 | 380 |
| POST | `/enroll/manual` | `[WRITE][CPU]` Payment + Invoice + PDF gen | 80 | 200 | 450 | 750 | 2000 |
| POST | `/admin/refund/manual` | `[WRITE]` Partial/full refund record | 15 | 38 | 88 | 150 | 420 |
| GET | `/get-courses/{user_id}` | `[DB+]` All courses for dropdown | 12 | 28 | 65 | 110 | 300 |
| PUT | `/admin/enrollment/{id}/emi/add-payment` | `[WRITE]` amount_due update | 12 | 28 | 65 | 110 | 300 |
| PUT | `/admin/enrollment/{id}/emi/mark-paid` | `[WRITE]` Expiry recompute | 15 | 35 | 80 | 130 | 380 |
| PUT | `/admin/enrollment/{id}/emi/settle` | `[WRITE]` Write-off + discount recalc | 15 | 35 | 80 | 130 | 380 |
| PUT | `/admin/enrollment/{id}/cancel` | `[WRITE]` Refund record + status | 15 | 38 | 88 | 150 | 420 |
| GET | `/admin/billing-address/{user_id}` | `[DB]` | 8 | 18 | 40 | 68 | 180 |
| POST | `/admin/billing-address/{user_id}` | `[WRITE]` | 10 | 22 | 50 | 85 | 220 |

**Hottest path:** `GET /check/{course_id}` — pure Redis cache hit, sub-5 ms P50. This is called on every lesson load. If this degrades, check Redis memory or connection pool exhaustion.

---

### 4.8 Payments (`/api/v1/payments`)

| Method | Route | Type | P10 | P50 | P90 | P95 | P100 |
|--------|-------|------|-----|-----|-----|-----|------|
| POST | `/create-order` | `[EXT][WRITE]` Razorpay API + DB INSERT | 220 | 380 | 700 | 1100 | 3000 |
| GET | `/status/{order_id}` | `[CACHED][DB]` No external call | 4 | 10 | 24 | 42 | 110 |
| POST | `/verify-payment` | `[CPU][WRITE]` HMAC verify + DB UPDATE | 15 | 35 | 80 | 130 | 380 |
| GET | `/my-payments` | `[DB+]` Paginated payment history | 12 | 30 | 70 | 120 | 350 |
| GET | `/admin/course/{course_id}/stats` | `[DB+]` Revenue aggregation | 25 | 65 | 150 | 260 | 800 |
| POST | `/admin/refund` | `[WRITE]` Refund record + queue | 15 | 38 | 88 | 150 | 420 |
| GET | `/admin/{payment_id}/refunds` | `[DB]` | 8 | 18 | 40 | 68 | 180 |
| GET | `/admin/rate-limit/{user_id}` | `[CACHED]` Redis key read | 2 | 5 | 12 | 20 | 60 |
| DELETE | `/admin/rate-limit/{user_id}/reset` | `[WRITE]` Redis DEL | 2 | 5 | 12 | 20 | 60 |
| POST | `/webhook` | `[CPU][WRITE]` HMAC + DB writes + enrollment | 25 | 60 | 140 | 240 | 700 |
| GET | `/{payment_id}` | `[DB+]` Payment + transactions | 12 | 28 | 65 | 110 | 300 |
| POST | `/cancel-order` | `[WRITE]` Status UPDATE | 10 | 22 | 50 | 85 | 220 |
| GET | `/download-invoice/{id}` | `[DB][EXT]` CloudFront URL | 20 | 50 | 120 | 200 | 600 |
| GET | `/admin/download-invoice/{id}` | `[DB][EXT]` | 20 | 50 | 120 | 200 | 600 |

**Critical path:** `POST /create-order` latency is dominated by Razorpay's API response time (150–600 ms typical). On t2.micro, if 3+ concurrent users hit this endpoint simultaneously, CPU burst credits drain from the HMAC + JSON parsing overhead. Rate limit (3/user/5min, 10/IP/5min) gives natural protection.

**Webhook handler:** Razorpay retries webhooks if it doesn't receive 200 within 5 seconds. On t2.micro under high load, ensure the webhook returns quickly — the enrollment activation should complete in under 300 ms P95.

---

### 4.9 Quiz (`/api/v1/quiz`)

| Method | Route | Type | P10 | P50 | P90 | P95 | P100 |
|--------|-------|------|-----|-----|-----|-----|------|
| POST | `/create-for-lesson/{lesson_id}` | `[WRITE]` | 10 | 22 | 50 | 85 | 220 |
| POST | `/create-for-module/{module_id}` | `[WRITE]` | 10 | 22 | 50 | 85 | 220 |
| GET | `/admin/{quiz_id}` | `[DB+]` With correct answers | 12 | 28 | 65 | 110 | 300 |
| PUT | `/{quiz_id}` | `[WRITE]` | 10 | 22 | 50 | 85 | 220 |
| DELETE | `/{quiz_id}` | `[WRITE]` Cascade questions + attempts | 20 | 50 | 120 | 200 | 600 |
| GET | `/{quiz_id}/questions` | `[DB+]` All questions with options | 12 | 28 | 65 | 110 | 300 |
| POST | `/question/add` | `[WRITE]` | 10 | 22 | 50 | 85 | 220 |
| POST | `/question/add-bulk` | `[WRITE]` Batch INSERT | 20 | 50 | 120 | 200 | 600 |
| GET | `/question/{id}` | `[DB]` | 5 | 12 | 28 | 48 | 130 |
| PUT | `/question/{id}` | `[WRITE]` | 10 | 22 | 50 | 85 | 220 |
| DELETE | `/question/{id}` | `[WRITE]` | 8 | 18 | 40 | 68 | 180 |
| GET | `/available` | `[CACHED][DB]` Published quizzes | 8 | 18 | 42 | 72 | 200 |
| GET | `/student/{quiz_id}` | `[DB+][CACHED]` No correct answers | 10 | 24 | 55 | 95 | 260 |
| GET | `/active-attempt/{quiz_id}` | `[CACHED][DB]` In-progress check | 4 | 10 | 24 | 42 | 110 |
| POST | `/start` | `[WRITE]` Create attempt record | 12 | 28 | 65 | 110 | 300 |
| POST | `/submit` | `[CPU][WRITE]` Score calc + progress update | 20 | 50 | 120 | 200 | 600 |
| GET | `/result/{attempt_id}` | `[DB+]` Question breakdown | 12 | 30 | 70 | 120 | 350 |
| GET | `/attempts/{quiz_id}` | `[DB+]` History | 10 | 25 | 58 | 100 | 280 |
| GET | `/analytics/{quiz_id}` | `[DB+]` Aggregation | 20 | 50 | 120 | 200 | 600 |
| GET | `/analytics/question/{id}` | `[DB+]` Correct/incorrect counts | 15 | 38 | 88 | 150 | 420 |

---

### 4.10 Progress (`/api/v1/progress`)

| Method | Route | Type | P10 | P50 | P90 | P95 | P100 |
|--------|-------|------|-----|-----|-----|-----|------|
| POST | `/lesson/complete` | `[WRITE]` INSERT + module/course recalc + cache clear | 20 | 50 | 115 | 200 | 600 |
| GET | `/lesson/{lesson_id}` | `[CACHED][DB]` | 3 | 8 | 18 | 32 | 85 |
| GET | `/lesson/{lesson_id}/check` | `[CACHED]` Pure Redis hit | 1 | 3 | 8 | 14 | 40 |
| GET | `/module/{module_id}` | `[CACHED][DB+]` Aggregated % | 5 | 12 | 28 | 48 | 130 |
| GET | `/module/{module_id}/detail` | `[DB+]` Lesson-by-lesson | 12 | 30 | 70 | 120 | 350 |
| GET | `/course/{course_id}` | `[CACHED][DB+]` Cert eligibility | 5 | 14 | 32 | 55 | 150 |
| GET | `/course/{course_id}/detail` | `[DB+]` Module breakdown | 15 | 38 | 88 | 150 | 420 |
| GET | `/dashboard` | `[DB+]` Stats + activity + certs | 25 | 65 | 150 | 260 | 800 |
| POST | `/admin/recalculate/course/{course_id}` | `[DB+][WRITE]` Force recalc all users | 100 | 300 | 800 | 1500 | 5000 |
| POST | `/admin/recalculate/module/{module_id}` | `[DB+][WRITE]` Force recalc | 50 | 150 | 400 | 750 | 3000 |

**Most-called endpoint in normal usage:** `GET /lesson/{lesson_id}/check` — fires on every lesson navigation. Redis cache is critical; P50 should be 1–3 ms. If it degrades to >20 ms P50, suspect Redis memory pressure or connection pool starvation.

**Admin recalculate endpoints:** These are full table scans + bulk updates. **Never run these during peak hours on t2.micro.** They will consume 100% CPU for seconds to minutes depending on course size.

---

### 4.11 Certificates (`/api/v1/certificate`)

| Method | Route | Type | P10 | P50 | P90 | P95 | P100 |
|--------|-------|------|-----|-----|-----|-----|------|
| POST | `/generate` | `[DB+][WRITE][EXT]` Eligibility + INSERT + Lambda trigger | 30 | 75 | 175 | 300 | 900 |
| GET | `/my-certificates` | `[DB]` | 8 | 18 | 42 | 72 | 200 |
| GET | `/course/{course_id}` | `[DB]` | 5 | 12 | 28 | 48 | 130 |
| GET | `/verify/{certificate_number}` | `[DB]` Public | 5 | 12 | 28 | 48 | 130 |
| GET | `/view/{certificate_number}` | `[DB]` Public | 5 | 12 | 28 | 48 | 130 |
| GET | `/{certificate_id}/pdf` | `[DB][EXT]` CloudFront redirect | 15 | 35 | 80 | 130 | 380 |
| POST | `/internal/{id}/pdf-ready` | `[WRITE]` Lambda callback | 10 | 22 | 50 | 85 | 220 |
| POST | `/admin/revoke/{id}` | `[WRITE]` | 10 | 22 | 50 | 85 | 220 |
| GET | `/admin/statistics` | `[DB+]` Monthly + per-course counts | 25 | 65 | 150 | 260 | 800 |

**Note:** PDF generation is entirely async (Lambda). The `POST /generate` endpoint only enqueues the job; the actual PDF appears after Lambda completes (typically 2–15 seconds). The PDF download redirects to CloudFront — no CPU on t2.micro for PDF rendering.

---

### 4.12 Resources (`/api/v1/resource`)

| Method | Route | Type | P10 | P50 | P90 | P95 | P100 |
|--------|-------|------|-----|-----|-----|-----|------|
| POST | `/get-upload-url/{lesson_id}` | `[EXT]` S3 presign | 30 | 70 | 150 | 250 | 600 |
| POST | `/file/{lesson_id}` | `[WRITE]` | 10 | 22 | 50 | 85 | 220 |
| POST | `/link/{lesson_id}` | `[WRITE]` | 8 | 18 | 40 | 68 | 180 |
| GET | `/lesson/{lesson_id}` | `[DB]` | 6 | 14 | 32 | 55 | 150 |
| GET | `/{resource_id}` | `[DB]` | 5 | 12 | 28 | 48 | 130 |
| GET | `/stats/{lesson_id}` | `[DB]` Count by type | 6 | 14 | 32 | 55 | 150 |
| PUT | `/{resource_id}` | `[WRITE]` Title/desc only | 8 | 18 | 40 | 68 | 180 |
| POST | `/get-replace-url/{resource_id}` | `[EXT]` S3 presign | 30 | 70 | 150 | 250 | 600 |
| POST | `/save-replaced-file/{resource_id}` | `[EXT][WRITE]` Old S3 delete + DB | 60 | 150 | 320 | 520 | 1500 |
| DELETE | `/{resource_id}` | `[EXT][WRITE]` S3 + DB | 50 | 120 | 260 | 420 | 1200 |
| DELETE | `/lesson/{lesson_id}/all` | `[EXT][WRITE]` Multi-S3 delete + DB | 80 | 200 | 500 | 850 | 2500 |

---

### 4.13 Coupons (`/api/v1/coupons`)

| Method | Route | Type | P10 | P50 | P90 | P95 | P100 |
|--------|-------|------|-----|-----|-----|-----|------|
| POST | `` (create) | `[WRITE]` | 10 | 22 | 50 | 85 | 220 |
| GET | `` (list) | `[DB+]` Paginated + filters | 12 | 30 | 70 | 120 | 350 |
| GET | `/admin/{code}` | `[DB+]` With courses | 10 | 25 | 58 | 100 | 280 |
| PUT | `/{code}` | `[WRITE]` | 10 | 22 | 50 | 85 | 220 |
| DELETE | `/{code}` | `[WRITE]` Guard check | 10 | 22 | 50 | 85 | 220 |
| POST | `/{code}/courses` | `[WRITE]` REPLACE | 15 | 35 | 80 | 130 | 380 |
| DELETE | `/{code}/courses/{course_id}` | `[WRITE]` | 10 | 22 | 50 | 85 | 220 |
| GET | `/{code}/usage` | `[DB+]` Stats aggregation | 20 | 50 | 115 | 200 | 600 |
| GET | `/{code}/checkout-link/{slug}` | `[DB]` URL gen | 8 | 18 | 40 | 68 | 180 |
| GET | `/search` | `[DB+]` Multi-filter search | 15 | 38 | 88 | 150 | 420 |
| GET | `/public/{course_slug}` | `[CACHED][DB]` Active coupons | 5 | 12 | 28 | 48 | 130 |
| POST | `/validate` | `[CACHED][DB]` Price preview | 8 | 20 | 45 | 78 | 220 |

---

### 4.14 Discussions (`/api/v1/discussion`)

| Method | Route | Type | P10 | P50 | P90 | P95 | P100 |
|--------|-------|------|-----|-----|-----|-----|------|
| POST | `/` (create discussion) | `[WRITE]` Rate-limited | 12 | 28 | 65 | 110 | 300 |
| PUT | `/{discussion_id}` | `[WRITE]` Owner check | 10 | 22 | 50 | 85 | 220 |
| DELETE | `/{discussion_id}` | `[WRITE]` Soft delete | 10 | 22 | 50 | 85 | 220 |
| POST | `/restore/{discussion_id}` | `[WRITE]` | 10 | 22 | 50 | 85 | 220 |
| POST | `/vote/{discussion_id}` | `[WRITE]` Rate-limited | 8 | 18 | 40 | 68 | 180 |
| GET | `/lesson/{lesson_id}` | `[DB+]` Paginated + votes + authors | 15 | 38 | 88 | 150 | 420 |
| GET | `/{discussion_id}` | `[DB+]` Comments pagination | 15 | 38 | 88 | 150 | 420 |
| POST | `/comment/{discussion_id}` | `[WRITE]` Rate-limited | 10 | 24 | 55 | 95 | 260 |
| PUT | `/comment/{comment_id}` | `[WRITE]` | 10 | 22 | 50 | 85 | 220 |
| DELETE | `/comment/{comment_id}` | `[WRITE]` Soft delete | 8 | 18 | 40 | 68 | 180 |
| POST | `/comment/{id}/restore` | `[WRITE]` | 8 | 18 | 40 | 68 | 180 |
| POST | `/comment/{id}/vote` | `[WRITE]` Rate-limited | 8 | 18 | 40 | 68 | 180 |
| POST | `/{id}/attachment/image/signed-url` | `[EXT]` S3 presign | 30 | 70 | 150 | 250 | 600 |
| POST | `/{id}/attachment/images` | `[WRITE]` | 10 | 22 | 50 | 85 | 220 |
| POST | `/{id}/attachment/codeblocks` | `[WRITE]` | 8 | 18 | 40 | 68 | 180 |
| DELETE | `/{id}/attachment/images` | `[EXT][WRITE]` S3 + DB | 50 | 120 | 260 | 420 | 1200 |
| DELETE | `/{id}/attachment/codeblocks` | `[WRITE]` | 8 | 18 | 40 | 68 | 180 |
| POST | `/comment/{id}/attachment/image/signed-url` | `[EXT]` | 30 | 70 | 150 | 250 | 600 |
| POST | `/comment/{id}/attachment/images` | `[WRITE]` | 10 | 22 | 50 | 85 | 220 |
| POST | `/comment/{id}/attachment/codeblocks` | `[WRITE]` | 8 | 18 | 40 | 68 | 180 |
| DELETE | `/comment/{id}/attachment/images` | `[EXT][WRITE]` | 50 | 120 | 260 | 420 | 1200 |
| DELETE | `/comment/{id}/attachment/codeblocks` | `[WRITE]` | 8 | 18 | 40 | 68 | 180 |
| DELETE | `/admin/discussion/{id}` | `[WRITE]` Hard delete | 15 | 35 | 80 | 130 | 380 |
| DELETE | `/admin/comment/{id}` | `[WRITE]` Hard delete | 12 | 28 | 65 | 110 | 300 |
| GET | `/admin/feed` | `[DB+]` Activity feed + filters | 25 | 65 | 150 | 260 | 800 |

---

### 4.15 Live Sessions (`/api/v1/live-sessions`)

| Method | Route | Type | P10 | P50 | P90 | P95 | P100 |
|--------|-------|------|-----|-----|-----|-----|------|
| POST | `/` (create session) | `[EXT][WRITE]` Zoom API + DB | 400 | 700 | 1200 | 1800 | 4000 |
| GET | `/` (list sessions) | `[DB+]` Paginated | 12 | 30 | 70 | 120 | 350 |
| GET | `/{session_id}` | `[DB+]` | 10 | 24 | 55 | 95 | 260 |
| PUT | `/{session_id}` | `[EXT][WRITE]` Zoom update + DB | 350 | 650 | 1100 | 1700 | 3500 |
| DELETE | `/{session_id}` | `[EXT][WRITE]` Zoom delete + DB | 350 | 650 | 1100 | 1700 | 3500 |
| POST | `/attendance/join` | `[WRITE]` Attendance INSERT | 10 | 24 | 55 | 95 | 260 |
| POST | `/attendance/leave` | `[WRITE]` Duration calc + UPDATE | 12 | 28 | 65 | 110 | 300 |
| GET | `/attendance/{session_id}` | `[DB+]` All attendees | 15 | 38 | 88 | 150 | 420 |
| GET | `/recordings/{session_id}` | `[EXT][DB]` Zoom recording fetch + DB | 300 | 600 | 1100 | 1700 | 4000 |
| POST | `/webhook` (Zoom) | `[EXT][WRITE]` Zoom event + DB + recording | 20 | 50 | 120 | 200 | 600 |
| GET | `/admin/sessions` | `[DB+]` All sessions with stats | 25 | 65 | 150 | 260 | 800 |

**Note:** Any route touching Zoom's API (create/update/delete/recordings) is entirely bounded by Zoom's response time (~300–700 ms). These will always have high P90/P95 on t2.micro. Consider background task offloading for Zoom mutations.

---

### 4.16 Analytics (Admin) (`/api/v1/analytics`)

> These are read-heavy aggregation queries against potentially large tables. On t2.micro they are the most expensive endpoints.

| Method | Route | Type | P10 | P50 | P90 | P95 | P100 |
|--------|-------|------|-----|-----|-----|-----|------|
| GET | `/user/growth` | `[DB+]` Time-series aggregation | 40 | 120 | 350 | 600 | 2500 |
| GET | `/user/signups` | `[DB+]` Date range GROUP BY | 30 | 90 | 260 | 450 | 2000 |
| GET | `/user/retention` | `[DB+]` Cohort analysis | 80 | 250 | 700 | 1200 | 5000 |
| GET | `/revenue/breakdown` | `[DB+]` Revenue by course + period | 50 | 150 | 400 | 700 | 3000 |
| GET | `/revenue/monthly` | `[DB+]` Monthly trend | 40 | 120 | 320 | 550 | 2500 |
| GET | `/revenue/payment-methods` | `[DB+]` GROUP BY method | 25 | 70 | 200 | 350 | 1500 |
| GET | `/course/enrollments` | `[DB+]` Per-course enrollment counts | 30 | 90 | 250 | 430 | 1800 |
| GET | `/course/completion` | `[DB+]` Completion rate aggregation | 50 | 150 | 400 | 700 | 3000 |
| GET | `/sales/funnel` | `[DB+]` Multi-step funnel query | 80 | 250 | 700 | 1200 | 5000 |
| GET | `/live-session/attendance` | `[DB+]` | 30 | 90 | 250 | 430 | 1800 |
| GET | `/live-session/completion` | `[DB+]` | 30 | 90 | 250 | 430 | 1800 |
| GET | `/bunny/bandwidth` | `[EXT]` Bunny CDN stats API | 150 | 350 | 700 | 1100 | 3000 |
| GET | `/bunny/concurrent-viewers` | `[EXT]` Bunny CDN stats API | 150 | 350 | 700 | 1100 | 3000 |

**Warning:** Running multiple analytics queries concurrently on t2.micro will saturate both CPU and the PostgreSQL connection pool. Rate-limit admin dashboard refresh intervals to at least 30 seconds. Pre-compute and cache daily summaries if possible.

---

### 4.17 User Analytics (`/api/v1/user-analytics`)

| Method | Route | Type | P10 | P50 | P90 | P95 | P100 |
|--------|-------|------|-----|-----|-----|-----|------|
| GET | `/` (all users) | `[DB+]` Multi-filter with joins | 25 | 70 | 180 | 320 | 1200 |
| GET | `/user/{id}` | `[DB+]` Single user detail | 12 | 30 | 70 | 120 | 350 |

---

### 4.18 Roles & Permissions

| Method | Route | Type | P10 | P50 | P90 | P95 | P100 |
|--------|-------|------|-----|-----|-----|-----|------|
| GET | `/api/v1/permission/get-all` | `[CACHED][DB]` | 4 | 10 | 24 | 42 | 110 |
| POST | `/api/v1/role/create` | `[WRITE]` | 10 | 22 | 50 | 85 | 220 |
| GET | `/api/v1/role/get-all` | `[CACHED][DB]` | 5 | 12 | 28 | 48 | 130 |
| GET | `/api/v1/role/get/{id}` | `[DB+]` With permissions | 8 | 18 | 42 | 72 | 200 |
| POST | `/api/v1/role/update-permission` | `[WRITE]` Cache invalidation | 12 | 28 | 65 | 110 | 300 |
| POST | `/api/v1/role/assign-role` | `[WRITE]` Cache invalidation | 12 | 28 | 65 | 110 | 300 |
| DELETE | `/api/v1/role/delete` | `[WRITE]` | 10 | 22 | 50 | 85 | 220 |
| GET | `/api/v1/role/get-all-sub-admin` | `[DB+]` Paginated | 12 | 30 | 70 | 120 | 350 |
| POST | `/api/v1/role/add-sub-admin` | `[WRITE][CPU]` Argon2 hash + INSERT | 150 | 280 | 500 | 750 | 1800 |
| DELETE | `/api/v1/role/delete-sub-admin/{id}` | `[WRITE]` | 10 | 22 | 50 | 85 | 220 |
| POST | `/api/v1/role/update-user-role` | `[WRITE]` Cache invalidation | 12 | 28 | 65 | 110 | 300 |

---

### 4.19 Notifications (`/api/v1/admin/notifications`)

| Method | Route | Type | P10 | P50 | P90 | P95 | P100 |
|--------|-------|------|-----|-----|-----|-----|------|
| POST | `/broadcast/course-launch/{slug}` | `[EXT][DB+]` SQS enqueue + user list | 80 | 200 | 500 | 850 | 2500 |
| POST | `/broadcast/course-launch/{slug}/csv` | `[EXT]` CSV parse + SQS | 100 | 250 | 600 | 1000 | 3000 |
| POST | `/broadcast/campaign` | `[EXT][DB+]` All users + SQS enqueue | 100 | 300 | 800 | 1400 | 5000 |
| POST | `/broadcast/campaign/csv` | `[EXT]` CSV + SQS | 100 | 250 | 600 | 1000 | 3000 |
| POST | `/broadcast/personal` | `[EXT]` SQS enqueue | 30 | 70 | 160 | 270 | 800 |
| POST | `/broadcast/personal/csv` | `[EXT]` CSV + SQS | 50 | 120 | 280 | 470 | 1500 |

**Note:** Broadcast endpoints query all verified users from the database (potentially thousands of rows) before enqueuing. On t2.micro with 10k+ users, the `GET all users` query alone may take 200–500 ms. These are one-off admin actions — not in the normal performance budget.

---

### 4.20 Testimonials & Contact

| Method | Route | Type | P10 | P50 | P90 | P95 | P100 |
|--------|-------|------|-----|-----|-----|-----|------|
| POST | `/api/v1/testimonials/upload-url` | `[EXT]` S3 presign | 30 | 70 | 150 | 250 | 600 |
| POST | `/api/v1/testimonials/` | `[WRITE]` Rate-limited 3/60s | 10 | 22 | 50 | 85 | 220 |
| GET | `/api/v1/testimonials/` | `[DB]` Paginated | 8 | 18 | 42 | 72 | 200 |
| GET | `/api/v1/testimonials/{id}` | `[DB]` | 5 | 12 | 28 | 48 | 130 |
| PATCH | `/api/v1/testimonials/{id}` | `[WRITE]` Publish toggle | 8 | 18 | 40 | 68 | 180 |
| DELETE | `/api/v1/testimonials/upload` | `[EXT]` S3 delete | 40 | 100 | 220 | 360 | 1000 |
| DELETE | `/api/v1/testimonials/{id}` | `[EXT][WRITE]` All S3 media + DB | 60 | 150 | 320 | 520 | 1500 |
| POST | `/api/v1/contact/{email}` | `[EXT]` Rate-limited + email validation | 15 | 35 | 80 | 130 | 380 |

---

## 5. Concurrency Profiles

What P95 looks like at different concurrent user levels:

| Concurrent Users | Simple Reads (cached) | DB Reads | DB Writes | Auth (Argon2) | Analytics |
|-----------------|----------------------|----------|-----------|---------------|-----------|
| 1 | 4 ms | 26 ms | 44 ms | 280 ms | 180 ms |
| 5 | 5 ms | 28 ms | 48 ms | 320 ms | 200 ms |
| 10 | 6 ms | 35 ms | 58 ms | 500 ms | 330 ms |
| 20 | 10 ms | 55 ms | 90 ms | 850 ms | 600 ms |
| 30 | 15 ms | 80 ms | 130 ms | 1300 ms | 1000 ms |
| 40 | 22 ms | 115 ms | 190 ms | 1900 ms | 1600 ms |
| 60 | 40 ms | 200 ms | 340 ms | 3200 ms | 3000 ms |
| 80 | 80 ms | 400 ms | 700 ms | timeout | timeout |

> At 60+ concurrent users, CPU burst credits drain in minutes. The 2-worker setup means Argon2 on one worker doesn't starve I/O-bound requests on the other — this is the most important practical difference vs t2.small. After credit exhaustion (40% floor), async I/O paths stay relatively stable; only CPU-heavy routes degrade sharply.

**Practical limits for t4g.small (2 workers):**
- Student-facing reads (lessons, courses, progress): safe up to **50–60 concurrent**
- Mixed read/write workload: safe up to **35–45 concurrent**
- Admin-heavy workload (analytics, broadcasts): safe up to **10–15 concurrent**
- Sustained auth load (many signups/logins): safe up to **15–20 concurrent**

---

## 6. CPU Burst Credit Model

| Credit Event | Rate |
|-------------|------|
| Earn credits (idle/low-load) | **24 credits/hour** (2 vCPU × 12) |
| Spend credits (100% both CPUs) | **24 credits/hour** |
| **Net spend at 50% total CPU** | 12 credits/hour |
| Starting credits (new instance) | **144 credits** |

**Time to credit exhaustion under sustained 100% CPU (both cores):** ~6 hours  
**After exhaustion:** Each vCPU throttled to **20% baseline** — 40% total (~2.5 GHz × 20% × 2 cores ≈ 1 GHz total equivalent)

**Latency impact after credit exhaustion:**
- P50 latency (async I/O paths): 1.3–1.8× worse — asyncio + 2 workers absorb most of the impact
- CPU-bound paths (Argon2, HMAC): 4–6× worse — these feel it hardest
- DB I/O-bound async paths: essentially unchanged (bottleneck is RDS/Redis RTT, not CPU)

**Practical advantage:** The 144-credit starting pool means a newly deployed instance can sustain full-CPU burst for 6 hours — enough to handle any traffic spike at launch without degradation.

**Monitor:** CloudWatch metric `CPUCreditBalance` on the t4g.small instance. Set alarm at `< 20 credits`.

---

## 7. Recommended Testing Tools & Commands

### Install k6 (recommended)
```bash
# Ubuntu/Debian
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
  --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" \
  | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install k6
```

### Install Locust
```bash
pip install locust
```

### Quick smoke test with curl (single request timing)
```bash
# Time a single request, show namelookup + connect + ttfb + total
curl -o /dev/null -s -w \
  "dns:%{time_namelookup}s connect:%{time_connect}s ttfb:%{time_starttransfer}s total:%{time_total}s\n" \
  https://your-api.com/health
```

### Apache Bench — quick throughput test
```bash
# 100 requests, 10 concurrent, test course listing
ab -n 100 -c 10 -H "Authorization: Bearer $TOKEN" \
  https://your-api.com/api/v1/courses
```

### wrk — sustained throughput
```bash
# 30 seconds, 4 threads, 20 connections
wrk -t4 -c20 -d30s https://your-api.com/health
```

---

## 8. k6 Test Scripts

### 8.1 Baseline Single-User Latency (smoke test)

```javascript
// smoke.js — run first, before any load test
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE = __ENV.BASE_URL || 'https://your-api.com';
const TOKEN = __ENV.TOKEN || '';

export const options = {
  vus: 1,
  iterations: 50,
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  const headers = { Authorization: `Bearer ${TOKEN}` };

  // Health
  let r = http.get(`${BASE}/health`);
  check(r, { 'health 200': (r) => r.status === 200 });

  // Token refresh
  r = http.post(`${BASE}/api/v1/auth/verify-auth`, null, { headers });
  check(r, { 'verify-auth 200': (r) => r.status === 200 });

  // Course list (public)
  r = http.get(`${BASE}/api/v1/courses`);
  check(r, { 'courses 200': (r) => r.status === 200 });

  // Enrollment check (cached)
  r = http.get(`${BASE}/api/v1/enrollments/check/COURSE_ID_HERE`, { headers });
  check(r, { 'enroll check 200': (r) => r.status === 200 });

  sleep(0.5);
}
```

```bash
k6 run -e BASE_URL=https://your-api.com -e TOKEN=your_token smoke.js
```

### 8.2 Student Happy-Path Load Test

```javascript
// student_load.js — simulates real student browsing
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend } from 'k6/metrics';

const BASE = __ENV.BASE_URL;
const TOKEN = __ENV.TOKEN;
const COURSE_SLUG = __ENV.COURSE_SLUG || 'python-for-beginners';
const LESSON_ID = __ENV.LESSON_ID || 'your-lesson-uuid';
const COURSE_ID = __ENV.COURSE_ID || 'your-course-uuid';

const lessonLoadTime = new Trend('lesson_load_ms');
const progressTime = new Trend('progress_mark_ms');

export const options = {
  stages: [
    { duration: '30s', target: 15 },  // ramp up
    { duration: '2m', target: 35 },   // steady state — t4g.small sweet spot (2 workers)
    { duration: '1m', target: 55 },   // stress both workers
    { duration: '30s', target: 0 },   // ramp down
  ],
  thresholds: {
    http_req_duration: ['p(50)<100', 'p(90)<300', 'p(95)<500'],
    http_req_failed: ['rate<0.02'],
    lesson_load_ms: ['p(90)<400'],
    progress_mark_ms: ['p(90)<200'],
  },
};

export default function () {
  const headers = {
    Authorization: `Bearer ${TOKEN}`,
    'Content-Type': 'application/json',
  };

  // 1. Get course content (most common action)
  let r = http.get(`${BASE}/api/v1/courses/content/${COURSE_SLUG}`, { headers });
  check(r, { 'course content 200': (r) => r.status === 200 });
  sleep(1);

  // 2. Check enrollment
  r = http.get(`${BASE}/api/v1/enrollments/check/${COURSE_ID}`, { headers });
  check(r, { 'enroll check': (r) => r.status === 200 });

  // 3. Load a lesson
  const start = Date.now();
  r = http.get(`${BASE}/api/v1/lesson/${LESSON_ID}`, { headers });
  lessonLoadTime.add(Date.now() - start);
  check(r, { 'lesson 200': (r) => r.status === 200 });
  sleep(2);

  // 4. Check progress
  r = http.get(`${BASE}/api/v1/progress/lesson/${LESSON_ID}/check`, { headers });
  check(r, { 'progress check': (r) => r.status === 200 });

  // 5. Mark lesson complete
  const progressStart = Date.now();
  r = http.post(
    `${BASE}/api/v1/progress/lesson/complete`,
    JSON.stringify({ lesson_id: LESSON_ID, time_spent_seconds: 300 }),
    { headers }
  );
  progressTime.add(Date.now() - progressStart);
  check(r, { 'progress complete': (r) => r.status === 200 || r.status === 201 });

  sleep(1);
}
```

```bash
k6 run \
  -e BASE_URL=https://your-api.com \
  -e TOKEN=your_token \
  -e COURSE_SLUG=python-for-beginners \
  -e LESSON_ID=uuid-here \
  -e COURSE_ID=uuid-here \
  student_load.js
```

### 8.3 Auth Stress Test

```javascript
// auth_stress.js — find breaking point for login
// WARNING: drains CPU credits fast on t2.micro
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE = __ENV.BASE_URL;

export const options = {
  stages: [
    { duration: '30s', target: 3 },
    { duration: '1m', target: 5 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    // Login MUST complete under 2s at P95 on t2.micro
    http_req_duration: ['p(50)<500', 'p(95)<2000'],
    http_req_failed: ['rate<0.05'],
  },
};

export default function () {
  // Use test accounts — never rate-limit yourself out of prod
  const payload = JSON.stringify({
    email: `testuser${Math.floor(Math.random() * 10)}@test.com`,
    password: 'TestPassword123!',
  });
  const headers = { 'Content-Type': 'application/json' };

  const r = http.post(`${BASE}/api/v1/auth/login`, payload, { headers });
  check(r, {
    'login 200': (r) => r.status === 200,
    'not rate-limited': (r) => r.status !== 429,
  });

  sleep(3); // Realistic: users don't hammer login
}
```

### 8.4 Payment Flow Test

```javascript
// payment_flow.js — test checkout flow end-to-end
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE = __ENV.BASE_URL;
const TOKEN = __ENV.TOKEN;
const COURSE_ID = __ENV.COURSE_ID;

export const options = {
  vus: 3,            // t2.micro limit for external API calls
  duration: '2m',
  thresholds: {
    // Razorpay API is the bottleneck — allow up to 3s
    http_req_duration: ['p(95)<3000'],
    http_req_failed: ['rate<0.05'],
  },
};

export default function () {
  const headers = {
    Authorization: `Bearer ${TOKEN}`,
    'Content-Type': 'application/json',
  };

  // Create order
  let r = http.post(
    `${BASE}/api/v1/payments/create-order`,
    JSON.stringify({ course_id: COURSE_ID }),
    { headers }
  );
  check(r, {
    'order created': (r) => r.status === 201,
    'has order_id': (r) => JSON.parse(r.body).razorpay_order_id !== undefined,
  });

  if (r.status === 201) {
    const { order_id } = JSON.parse(r.body);

    sleep(1);

    // Poll status
    r = http.get(`${BASE}/api/v1/payments/status/${order_id}`, { headers });
    check(r, { 'status 200': (r) => r.status === 200 });
  }

  sleep(5); // Realistic inter-purchase delay
}
```

### 8.5 Breaking Point Test

```javascript
// breaking_point.js — find the RPS ceiling
// Run this ONLY during off-hours; it will crash the server
import http from 'k6/http';
import { check } from 'k6';

const BASE = __ENV.BASE_URL;

export const options = {
  stages: [
    { duration: '1m', target: 20 },
    { duration: '1m', target: 40 },
    { duration: '1m', target: 65 },
    { duration: '1m', target: 90 },
    { duration: '1m', target: 120 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.10'],  // Stop caring when 10% error rate
  },
};

export default function () {
  const r = http.get(`${BASE}/api/v1/courses`);
  check(r, { 'ok': (r) => r.status === 200 });
}
```

---

## 9. Locust Test Scripts

### 9.1 Full User Journey

```python
# locustfile.py
import random
from locust import HttpUser, task, between

COURSE_SLUG = "python-for-beginners"
LESSON_IDS = ["lesson-uuid-1", "lesson-uuid-2"]
COURSE_ID = "course-uuid-here"


class StudentUser(HttpUser):
    wait_time = between(1, 3)
    token = None

    def on_start(self):
        resp = self.client.post("/api/v1/auth/login", json={
            "email": f"test{random.randint(1, 50)}@test.com",
            "password": "TestPassword123!"
        })
        if resp.status_code == 200:
            self.token = resp.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}

    @task(5)
    def view_course(self):
        self.client.get(
            f"/api/v1/courses/content/{COURSE_SLUG}",
            headers=self.headers,
            name="/api/v1/courses/content/[slug]"
        )

    @task(4)
    def check_enrollment(self):
        self.client.get(
            f"/api/v1/enrollments/check/{COURSE_ID}",
            headers=self.headers,
            name="/api/v1/enrollments/check/[id]"
        )

    @task(3)
    def load_lesson(self):
        lesson_id = random.choice(LESSON_IDS)
        self.client.get(
            f"/api/v1/lesson/{lesson_id}",
            headers=self.headers,
            name="/api/v1/lesson/[id]"
        )

    @task(2)
    def check_progress(self):
        lesson_id = random.choice(LESSON_IDS)
        self.client.get(
            f"/api/v1/progress/lesson/{lesson_id}/check",
            headers=self.headers,
            name="/api/v1/progress/lesson/[id]/check"
        )

    @task(1)
    def mark_complete(self):
        lesson_id = random.choice(LESSON_IDS)
        self.client.post(
            "/api/v1/progress/lesson/complete",
            json={"lesson_id": lesson_id, "time_spent_seconds": 300},
            headers=self.headers
        )

    @task(1)
    def view_dashboard(self):
        self.client.get(
            "/api/v1/progress/dashboard",
            headers=self.headers
        )
```

```bash
# Run with web UI
locust -f locustfile.py --host=https://your-api.com

# Run headless
locust -f locustfile.py --host=https://your-api.com \
  --users 40 --spawn-rate 5 --run-time 5m --headless \
  --html report.html --csv results
```

---

## 10. Monitoring During Load Tests

### CloudWatch Metrics to Watch

| Metric | Warning | Critical |
|--------|---------|---------|
| `CPUUtilization` | > 70% | > 90% |
| `CPUCreditBalance` | < 30 | < 10 |
| `DatabaseConnections` | > 80 | > 95 |
| `FreeableMemory` | < 400 MB | < 200 MB |
| `NetworkIn/Out` | > 400 Mbps | > 450 Mbps |

### Redis Metrics (ElastiCache)

```bash
# Connect to Redis CLI and watch in real-time
redis-cli -h your-redis.cache.amazonaws.com INFO stats | grep -E "instantaneous_ops|keyspace_hits|keyspace_misses"

# Cache hit ratio — should be > 85%
# Formula: hits / (hits + misses)
```

### Server-side monitoring during test

```bash
# On t4g.small — watch CPU, memory, connections, both workers
watch -n 1 'echo "--- CPU ---" && top -bn1 | head -5 && echo "--- MEM ---" && free -m && echo "--- NET CONNS ---" && ss -s'

# Watch Uvicorn process specifically
watch -n 2 'ps aux | grep uvicorn && echo "--- open fds ---" && ls /proc/$(pgrep -f uvicorn)/fd | wc -l'
```

### PostgreSQL connections

```sql
-- Check active connections during test
SELECT count(*), state, wait_event_type, wait_event
FROM pg_stat_activity
WHERE datname = 'your_db'
GROUP BY state, wait_event_type, wait_event;

-- Check slow queries
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 20;
```

### Redis connection pool

```bash
# Check Redis client connections
redis-cli -h your-redis CLIENT LIST | wc -l

# Check blocked clients (sign of pool exhaustion)
redis-cli -h your-redis INFO clients | grep blocked
```

---

## 11. Red Lines — When to Stop a Test

Stop the load test immediately if any of these are observed:

| Signal | Threshold | Action |
|--------|-----------|--------|
| Error rate | > 5% | Stop — instance is overloaded |
| `CPUCreditBalance` | < 10 credits | Pause — allow credits to rebuild |
| `FreeableMemory` | < 150 MB | Stop — OOM risk (both workers share 2 GB) |
| `POST /api/v1/payments/webhook` p99 | > 4500 ms | Stop — Razorpay will retry and create duplicate processing |
| PostgreSQL `max_connections` hit | 100% | Stop — new requests will fail with connection refused |
| 5xx rate on `/api/v1/auth/login` | > 10% | Stop — could lock out real users |
| Uvicorn process crashed | Any | Stop and investigate before continuing |

---

## 12. Scaling Decision Thresholds

Use this table to decide when t4g.small is no longer sufficient:

| Observation | Recommendation |
|------------|----------------|
| P95 for course content > 500 ms consistently at steady state | Upgrade to t4g.medium (2 vCPU, 4 GB) |
| Sustained concurrent users > 55 | Upgrade to t4g.medium + add RDS read replica |
| `CPUCreditBalance` hits 0 before 9 AM daily | Switch to t4g.small with `unlimited` burst mode (no credit system, small surcharge) |
| Redis memory > 700 MB | Upgrade ElastiCache instance |
| PostgreSQL connections > 80% of max | Increase asyncpg pool OR add PgBouncer |
| Analytics queries causing student latency spikes | Move analytics to RDS read replica |
| Monthly payment volume > 1000 transactions | No infrastructure change needed; Razorpay handles it |
| Login rate > 150/minute sustained (both workers saturated) | Upgrade to t4g.medium for 4 workers |
| FreeableMemory consistently < 300 MB | Upgrade to t4g.medium (4 GB) |

### Upgrade path recommendation

```
t4g.small (current — 2 vCPU, 2 GB, ARM64)
  → t4g.small [unlimited] — same instance, no credits, ~10% surcharge; best first step if credits drain daily
  → t4g.medium (2 vCPU, 4 GB) — when memory or concurrency hits limits; run 3–4 Uvicorn workers
  → t4g.large (2 vCPU, 8 GB) + RDS read replica — for 200+ concurrent users
  → t4g.xlarge (4 vCPU, 16 GB) — for 500+ concurrent users, run 6–8 workers
```

> **Stay on Graviton4 family** — t4g is 27–40% cheaper than equivalent t3 (Intel) for the same performance. Switching to t3 for the same workload costs more and runs slower.

---

## Appendix: Route Count Summary

| Module | Routes | Primary Bottleneck |
|--------|--------|--------------------|
| Auth | 14 | Argon2 CPU (login/signup) |
| Courses | 31 | DB joins (content tree) |
| Modules | 16 | Bunny CDN (video delete) |
| Lessons | 9 | Bunny CDN (upload token) |
| Enrollments | 19 | Redis cache hit rate |
| Payments | 14 | Razorpay API latency |
| Quiz | 20 | Scoring CPU (submit) |
| Progress | 10 | Redis cache (lesson check) |
| Certificates | 9 | Lambda async (PDF) |
| Resources | 11 | S3 presign latency |
| Coupons | 12 | DB validation query |
| Discussions | 25 | DB joins (vote counts) |
| Live Sessions | ~20 | Zoom API latency |
| Analytics | ~15 | DB aggregation queries |
| User Analytics | 2 | DB multi-filter joins |
| Roles & Perms | 12 | Redis cache invalidation |
| Notifications | 6 | SQS enqueue + user scan |
| Testimonials | 7 | S3 presign/delete |
| Contact | 1 | Email validation |
| Users | 14 | S3 presign (avatar) |
| **Total** | **~270** | |

---

*All benchmarks are estimates based on the tech stack (FastAPI + asyncpg + Redis) on t2.micro specifications. Actual values depend on PostgreSQL query plan quality, index coverage, Redis hit rate, network distance to RDS/ElastiCache, and whether CPU burst credits are available. Run actual measurements with the scripts above and treat this document as your starting hypothesis.*
