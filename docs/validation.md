# Finding Confirmation

Validation of Pass 2 findings against the target application's known challenges and source code evidence. One entry per CWE, with the strongest code evidence and matching challenge(s) where they exist.

The target app ships with 107 documented challenges in `data/static/challenges.yml`. Not all map to our CWE scope — many are injection (A03), XSS (A07), or OSINT challenges outside A06 (Insecure Design). We map where they do.

## CWE-269 — Improper Privilege Management (D1, D2, D3)

**Finding:** 58 of 109 routes have no auth middleware. 5 route files perform DB writes without auth. Security kernel (`lib/insecurity.ts`) is a single point of failure with `hash` at 9-file fan-in.

**Code evidence — unprotected admin endpoints (D1):**
```typescript
// server.ts:651-652 — admin endpoints registered with no auth middleware
app.get('/rest/admin/application-version', appVersion())
app.get('/rest/admin/application-configuration', retrieveAppConfiguration())
```

**Code evidence — password change via GET, no auth (D1+D2):**
```typescript
// server.ts:590 — no security.* middleware
app.get('/rest/user/change-password', changePassword())

// routes/changePassword.ts:51 — DB write from unprotected route
user.update({ password: newPasswordInString })
```

**Challenge matches:**
| Challenge | Category | Key | Relevance |
|-----------|----------|-----|-----------|
| Admin Section | Broken Access Control | `adminSectionChallenge` | Admin section accessible — matches D1 unprotected admin routes |
| Change User1's Password | Broken Authentication | `changePasswordUser1Challenge` | Password change exploitable — matches D1+D2 (no auth, GET method) |
| View Basket | Broken Access Control | `basketAccessChallenge` | Another user's basket viewable — matches D1 access control gaps |
| Five-Star Feedback | Broken Access Control | `feedbackChallenge` | Delete feedback — matches D1 broken access control |

**Confirmed:** Known challenges exploit the exact routes our D1 query identified as unprotected.

---

## CWE-311 — Missing Encryption of Sensitive Data (D4)

**Finding:** Passwords hashed with MD5 (no salt, no stretching). Card numbers stored as plaintext integers. TOTP secrets stored unencrypted. HMAC key hardcoded in source.

**Code evidence — MD5 password hashing:**
```typescript
// lib/insecurity.ts — hash function
(data: string) => crypto.createHash('md5').update(data).digest('hex')
```

**Code evidence — hardcoded HMAC key:**
```typescript
// lib/insecurity.ts — hmac function
(data: string) => crypto.createHmac('sha256', 'pa4qacea4VK9t9nGv7yZtwmj').update(data).digest('hex')
```

**Code evidence — TOTP secret stored plaintext:**
```typescript
// models/user.ts — password setter uses hash, but totpSecret has no setter/encryption
set (clearTextPassword: string) {
  this.setDataValue('password', security.hash(clearTextPassword))
}
// totpSecret: stored as-is via userModel.update({ totpSecret: secret })
```

**Challenge matches:**
| Challenge | Category | Key | Relevance |
|-----------|----------|-----|-----------|
| Password Strength | Broken Authentication | `weakPasswordChallenge` | Admin password crackable because MD5 is trivially reversible — matches D4 |
| Weird Crypto | Cryptographic Issues | `weirdCryptoChallenge` | "Algorithm it should not use" — MD5 for passwords, exact D4 finding |
| Two Factor Authentication | Broken Authentication | `twoFactorAuthUnsafeSecretStorageChallenge` | "2FA secret stored unsafely" — TOTP plaintext storage, exact D4 finding |

**Confirmed:** Three challenges directly exploit the cryptographic weaknesses D4 identified.

---

## CWE-434 — Unrestricted Upload of File with Dangerous Type (D5)

**Finding:** 4 upload routes with zero content validation. `checkFileType` and `checkUploadSize` middleware always call `next()` — they're challenge solvers, not validators.

**Code evidence — fake file type validation:**
```typescript
// routes/fileUpload.ts — checkFileType always passes
// Extension is checked for challenge solving, but next() is called regardless
if (utils.endsWith(file?.originalname.toLowerCase(), '.zip')) {
  // ... challenge solving logic ...
}
// falls through to next() whether .zip or not
```

**Code evidence — fake size validation:**
```typescript
// routes/fileUpload.ts — checkUploadSize always passes
if (file?.buffer && file.buffer.length > 100000) {
  // ... challenge solving logic ...
}
// falls through to next() regardless of size
```

**Challenge matches:**
| Challenge | Category | Key | Relevance |
|-----------|----------|-----|-----------|
| Upload Size | Improper Input Validation | `uploadSizeChallenge` | "Upload file larger than 100 kB" — possible because checkUploadSize always passes, exact D5 finding |
| Upload Type | Improper Input Validation | `uploadTypeChallenge` | "Upload file with no .pdf/.zip extension" — possible because checkFileType always passes, exact D5 finding |
| Arbitrary File Write | Vulnerable Components | `fileWriteChallenge` | "Overwrite Legal Information file" — enabled by unrestricted upload, D5 prerequisite |

**Confirmed:** Two challenges directly exploit the fake validation D5 identified. The challenge design confirms these middleware are intentionally non-blocking.

---

## CWE-501 — Trust Boundary Violation (D6)

**Finding:** 22 DB operations use `req.body/query/params` directly without validation. Mass assignment allows setting `role: admin` during registration. Chatbot query text overwrites username.

**Code evidence — mass assignment:**
```typescript
// server.ts:402-415 — POST /api/Users passes full req.body to Sequelize
// No field allowlist — attacker can include { role: 'admin' } in request body
app.post('/api/Users', (req: Request, res: Response, next: NextFunction) => {
  if (req.body.email !== undefined && req.body.password !== undefined) {
    // ... only trims email and password, doesn't strip extra fields ...
  }
  next()
})
```

**Code evidence — chatbot overwrites username:**
```typescript
// routes/chatbot.ts:141
const updatedUser = await userModel.update({ username: req.body.query })
```

**Challenge matches:**
| Challenge | Category | Key | Relevance |
|-----------|----------|-----|-----------|
| Admin Registration | Improper Input Validation | `registerAdminChallenge` | "Register with admin privileges" — mass assignment, exact D6 finding |
| Forged Feedback | Broken Access Control | `forgedFeedbackChallenge` | "Post feedback as another user" — req.body trust, D6 pattern |
| Forged Review | Broken Access Control | `forgedReviewChallenge` | "Edit any user's review" — req.body.id in MongoDB update, exact D6 finding |
| Manipulate Basket | Broken Access Control | `basketManipulateChallenge` | "Put product in another user's basket" — req.body trust, D6 pattern |
| NoSQL Manipulation | Injection | `noSqlReviewsChallenge` | "Update multiple reviews" — req.body.id in MongoDB, exact D6 finding |

**Confirmed:** Five challenges exploit the exact trust boundary patterns D6 identified. `registerAdminChallenge` is the textbook mass assignment case.

---

## CWE-602 — Client-Side Enforcement of Server-Side Security (D7)

**Finding:** 5 validation checks across 109 handlers (4.6%). All are password-emptiness checks. No type, format, length, or schema validation on any server-side input.

**Code evidence — no server-side validation on rating:**
```typescript
// models/feedback.ts — rating setter (model layer, not input validation)
set (rating: number) {
  this.setDataValue('rating', rating)
  challengeUtils.solveIf(challenges.zeroStarsChallenge, () => {
    return Number(rating) === 0
  })
}
// UI prevents 0 stars, server accepts it — client-side enforcement only
```

**Code evidence — no server-side validation on order quantities:**
```typescript
// routes/basketItems.ts — quantity from req.body used directly
// Negative quantities enable "Payback Time" challenge
```

**Challenge matches:**
| Challenge | Category | Key | Relevance |
|-----------|----------|-----|-----------|
| Zero Stars | Improper Input Validation | `zeroStarsChallenge` | "Give zero-star feedback" — UI prevents it, server accepts it, exact D7 pattern |
| Empty User Registration | Improper Input Validation | `emptyUserRegistration` | "Register with empty email/password" — server allows it, D7 pattern |
| Repetitive Registration | Improper Input Validation | `passwordRepeatChallenge` | "DRY violation in registration" — password repeat not enforced server-side |
| Payback Time | Improper Input Validation | `negativeOrderChallenge` | "Place order that makes you rich" — negative quantities not validated server-side |

**Confirmed:** Four challenges exploit the exact client-side-only validation pattern D7 identified.

---

## CWE-653 — Improper Isolation / Compartmentalization (D8)

**Finding:** 4 unprotected route handlers directly call security-critical functions (`hash`, `hmac`, `authorize`, `verify`). Unauthenticated users can reach password operations, JWT generation, and DB writes.

**Code evidence — unauthenticated access to security functions:**
```typescript
// routes/changePassword.ts — no auth, calls security.hash()
// server.ts:590 — registered without any security.* middleware
app.get('/rest/user/change-password', changePassword())

// routes/chatbot.ts:143-144 — no auth, calls security.authorize() and security.verify()
const updatedToken = security.authorize(updatedUserResponse)
```

**Code evidence — metrics endpoint without auth:**
```typescript
// server.ts:655 — Prometheus metrics exposed without auth
app.get('/metrics', metrics.updateLoop(), metrics.serveMetrics())
```

**Challenge matches:**
| Challenge | Category | Key | Relevance |
|-----------|----------|-----|-----------|
| Exposed Metrics | Observability Failures | `exposedMetricsChallenge` | "Find Prometheus endpoint" — matches D1/D8 unprotected metrics route |
| Change User1's Password | Broken Authentication | `changePasswordUser1Challenge` | Password change without auth reaches hash — exact D8 isolation gap |

**Confirmed:** Challenges confirm unprotected routes reaching privileged operations.

---

## CWE-799 — Improper Control of Interaction Frequency (D9)

**Finding:** 4 of 109 routes (3.7%) have rate limiting. Login, registration, and all file uploads have none. Password reset rate limiter uses spoofable `X-Forwarded-For` for key generation.

**Code evidence — login without rate limiting:**
```typescript
// server.ts:589 — no rateLimit middleware on login
app.post('/rest/user/login', login())

// Compare with rate-limited endpoint:
// server.ts:591 — rate limiting present but bypassable
app.use('/rest/user/reset-password', new RateLimit({
  windowMs: 5 * 60 * 1000,
  max: 100,
  keyGenerator({ headers, ip }) { return headers['x-forwarded-for'] || ip }
  // ↑ X-Forwarded-For is spoofable — attacker rotates header value
}))
```

**Challenge matches:**
| Challenge | Category | Key | Relevance |
|-----------|----------|-----|-----------|
| CAPTCHA Bypass | Broken Anti Automation | `captchaBypassChallenge` | "Submit 10+ feedbacks in 20 seconds" — possible because no rate limiting on feedback, D9 finding |
| Reset User3's Password | Broken Anti Automation | `resetPasswordUser3Challenge` | "Brute force despite rate limiting" — rate limiter bypassable, D9 finding |

**Confirmed:** Challenges exploit the exact rate limiting gaps D9 identified.

---

## CWE-841 — Improper Enforcement of Behavioral Workflow (D10)

**Finding:** Purchase flow has no server-side state machine. Steps (address, payment, delivery, coupon, checkout) can be called independently and out of order. Coupon can be applied to any basket regardless of ownership.

**Code evidence — checkout without payment verification:**
```typescript
// routes/order.ts:placeOrder — verifies basket and delivery, but NOT address or payment
BasketModel.findOne({ where: { id }, include: [{ model: ProductModel }] })
DeliveryModel.findOne({ where: { id: req.body.orderDetails.deliveryMethodId } })
WalletModel.findOne({ where: { UserId: req.body.UserId } })
// No AddressModel.findOne, no CardModel.findOne — skippable steps
```

**Code evidence — coupon applied to any basket:**
```typescript
// routes/order.ts:applyCoupon — no ownership check on basket
const basket = await BasketModel.findByPk(id)  // id from URL params, no UserId check
await basket.update({ coupon: coupon?.toString() })
```

**Challenge matches:**
| Challenge | Category | Key | Relevance |
|-----------|----------|-----|-----------|
| Deluxe Fraud | Improper Input Validation | `freeDeluxeChallenge` | "Obtain Deluxe Membership without paying" — workflow bypass, exact D10 pattern |
| Payback Time | Improper Input Validation | `negativeOrderChallenge` | "Place order that makes you rich" — order workflow bypass, D10 pattern |
| Expired Coupon | Improper Input Validation | `manipulateClockChallenge` | "Redeem expired coupon" — coupon validation bypassable, D10 related |

**Confirmed:** Challenges exploit the workflow gaps D10 identified.

---

## CWE-1125 — Excessive Attack Surface (D11)

**Finding:** 59 unauthenticated entry points (53% of routes), 22 unvalidated data paths, 4 upload routes with no validation, 1 WebSocket with no auth. Security concentrated in one file.

**Code evidence — deprecated interface still active:**
```typescript
// server.ts — B2B interface registered and accessible
app.use('/b2b/v2', security.isAuthorized())
// But the deprecated B2B XML interface is accessible via file upload without the /b2b path
```

**Challenge matches:**
| Challenge | Category | Key | Relevance |
|-----------|----------|-----|-----------|
| Deprecated Interface | Security Misconfiguration | `deprecatedInterfaceChallenge` | "Use deprecated B2B interface" — excessive attack surface, D11 finding |
| Score Board | Miscellaneous | `scoreBoardChallenge` | "Find hidden Score Board" — unnecessary exposed functionality |
| Exposed Metrics | Observability Failures | `exposedMetricsChallenge` | "Find Prometheus endpoint" — unnecessary exposure |
| Confidential Document | Sensitive Data Exposure | `directoryListingChallenge` | "Access confidential document" — excessive file exposure |

**Confirmed:** Challenges reflect the broad attack surface D11 quantified.

---

## Summary

| CWE | Finding | Challenges matched | Code evidence | Confirmed? |
|-----|---------|:------------------:|:-------------:|:----------:|
| 269 | 58 unprotected routes, password change no auth | 4 | server.ts:590, changePassword.ts:51 | Yes |
| 311 | MD5 passwords, plaintext cards/TOTP, hardcoded HMAC | 3 | insecurity.ts:hash, insecurity.ts:hmac | Yes |
| 434 | 4 uploads, fake validators | 3 | fileUpload.ts:checkFileType/checkUploadSize | Yes |
| 501 | 22 untrusted DB ops, mass assignment, chatbot→username | 5 | server.ts:402, chatbot.ts:141 | Yes |
| 602 | 5/109 validation checks (4.6%) | 4 | feedback model:set, basketItems | Yes |
| 653 | 4 unprotected handlers reach security functions | 2 | changePassword, chatbot.ts:143 | Yes |
| 799 | 4/109 rate-limited (3.7%), login unprotected | 2 | server.ts:589 | Yes |
| 841 | No server-side workflow state machine | 3 | order.ts:placeOrder | Yes |
| 1125 | 59 unauthenticated entry points | 4 | deprecated interface, metrics | Yes |

**Total: 30 challenge matches across 8 CWEs.** All findings confirmed by either source code evidence, known challenge documentation, or both. No false positives identified — every finding maps to a known exploitable issue in the target application.
