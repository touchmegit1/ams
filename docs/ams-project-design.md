# AMS — Project Design and Completion Flows

Phạm vi: AMS Course Management (G1–G3). Subject trong yêu cầu được biểu diễn bởi `Course`; Assignment là bài tập thuộc một Course. Các luồng bên dưới bám vào backend Spring Boot, frontend React, MySQL/H2, Google/Mail, SePay và Gemini hiện có.

## 1. Five use case diagrams

### 1. Login System
```mermaid
flowchart LR
  Student[Student] --> Login((Sign in / Register))
  Teacher[Teacher] --> Login
  Login --> Email[Email and password]
  Login --> Google[Google Login]
  Login --> Recovery[OTP password recovery]
  Email --> AMS[AMS]
  Google <--> GoogleSvc[Google Identity]
  Recovery <--> Mail[Mail service]
  AMS --> Role[Role protected workspace]
```

### 2. Manage Courses
```mermaid
flowchart LR
  Teacher[Teacher] --> Manage((Manage course, module, lesson))
  Admin[Admin] --> Manage
  Manage --> Draft[Create / edit draft]
  Manage --> Structure[Order modules and lessons]
  Manage --> Publish[Publish / archive]
  Student[Student] --> Browse[Browse published courses]
  Student --> Learn[Open lessons when enrolled]
  Manage --> CourseAPI[Course management API]
```

### 3. Manage Subject Assignments
```mermaid
flowchart LR
  Teacher[Teacher] --> Manage((Manage assignments for a course))
  Admin[Admin] --> Manage
  Manage --> Compose[Create document or quiz]
  Manage --> Rubric[Set rubric, score and deadline]
  Manage --> AI[Generate assignment draft with Gemini]
  Manage --> Publish[Publish / close / archive]
  Student[Enrolled student] --> View[View published assignment]
```

### 4. Enroll Course with Payment
```mermaid
flowchart LR
  Student[Student] --> Catalog((Enroll in course))
  Catalog --> Free[Free course]
  Catalog --> Paid[Paid course]
  Free --> Active[Active enrollment]
  Paid --> Order[Create payment and QR]
  Order <--> Sepay[SePay]
  Sepay --> Webhook[Verified payment webhook]
  Webhook --> Active
  Active --> Class[Enter course and view lessons]
  Admin[Admin] --> Review[Review unmatched payments]
```

### 5. Submit & Evaluate Assignment with AI
```mermaid
flowchart LR
  Student[Enrolled student] --> Submit((Submit assignment))
  Submit --> Document[Upload document]
  Submit --> Quiz[Answer quiz]
  Document --> AI[Gemini evaluation]
  Quiz --> Grader[Deterministic quiz grader]
  AI --> Result[Evaluation result or retry state]
  Grader --> Result
  Teacher[Course teacher] --> Review[Review score and feedback]
  Result --> Review
  Review --> Official[Official score and feedback]
```

## 2. Five activity diagrams for integrated flows

### 1. Login with Google or email recovery
```mermaid
flowchart TD
  A([Start]) --> B{Choose login method}
  B -->|Email| C[Submit credentials]
  C --> D{Valid and active?}
  D -->|Yes| H[Issue JWT and route by role]
  D -->|No| E[Show authentication error]
  B -->|Google| F[Obtain Google ID token]
  F --> G[Backend verifies token with Google]
  G --> I{Verified?}
  I -->|Yes| H
  I -->|No| E
  B -->|Recover| J[Request OTP]
  J --> K[Mail service sends OTP]
  K --> L[Verify OTP and reset password]
  L --> H
```

### 2. Manage course curriculum
```mermaid
flowchart TD
  A([Start]) --> B[Teacher creates course draft]
  B --> C[Add and order modules]
  C --> D[Add and order lessons]
  D --> E{Course information valid?}
  E -->|No| F[Show validation errors and edit]
  F --> D
  E -->|Yes| G[Preview curriculum]
  G --> H[Publish course]
  H --> I[Published course appears in student catalog]
  I --> J([End])
```

### 3. Create and publish a subject assignment
```mermaid
flowchart TD
  A([Start]) --> B[Select owned course]
  B --> C[Enter assignment, rubric, deadline and score]
  C --> D{Request AI draft?}
  D -->|Yes| E[Backend sends prompt to Gemini]
  E --> F{Gemini response valid?}
  F -->|No| G[Show retryable error; do not persist]
  G --> D
  F -->|Yes| H[Teacher reviews and edits draft]
  D -->|No| I[Teacher writes content]
  H --> J[Save draft]
  I --> J
  J --> K{Rubric totals 100% and deadline valid?}
  K -->|No| C
  K -->|Yes| L[Publish assignment]
  L --> M([End])
```

### 4. Enroll, pay and enter the class
```mermaid
flowchart TD
  A([Start]) --> B[Student selects published course]
  B --> C{Price is zero?}
  C -->|Yes| D[Create ACTIVE enrollment]
  C -->|No| E[Create pending payment and QR]
  E --> F[Student pays through bank transfer]
  F --> G[SePay posts webhook]
  G --> H{Signature, account, amount, code and time valid?}
  H -->|No| I[Record payment review; keep access closed]
  H -->|Yes| D
  D --> J[Show course in My Courses]
  J --> K[Open lessons and assignments]
  K --> L([End])
```

### 5. Submit and evaluate assignment
```mermaid
flowchart TD
  A([Start]) --> B[Student opens assignment]
  B --> C{Enrolled, published and before deadline?}
  C -->|No| D[Reject viewing or submission]
  C -->|Yes| E{Assignment type}
  E -->|Quiz| F[Submit answers]
  F --> G[Deterministic scoring]
  E -->|Document| H[Upload allowed files and notes]
  H --> I[Extract text and evaluate with Gemini]
  I --> J{Evaluation succeeds?}
  J -->|No| K[Save submission as AI_FAILED]
  J -->|Yes| L[Save AI score and feedback]
  G --> L
  K --> M[Teacher retries or grades manually]
  L --> N[Teacher reviews and sets official score]
  M --> N
  N --> O[Student sees reviewed result]
  O --> P([End])
```

## 3. Five sequence diagrams for external integrations

### 1. Login and recovery
```mermaid
sequenceDiagram
  actor User
  participant UI as React UI
  participant API as AMS Auth API
  participant Google as Google Identity
  participant Mail as Mail service
  User->>UI: Sign in with email or Google
  alt Google sign in
    UI->>Google: Authenticate
    Google-->>UI: ID token
    UI->>API: POST Google token
    API->>Google: Verify ID token
    Google-->>API: Verified identity
  else Email sign in
    UI->>API: POST email/password
  end
  API-->>UI: JWT and role
  opt Password recovery
    UI->>API: Request OTP
    API->>Mail: Send OTP email
    Mail-->>User: OTP
    UI->>API: Verify OTP and reset password
  end
```

### 2. Course management (no external service in current implementation)
```mermaid
sequenceDiagram
  actor Teacher
  participant UI as React Course UI
  participant API as Course API
  participant DB as Course database
  Teacher->>UI: Create course and curriculum
  UI->>API: POST/PUT course, module and lesson
  API->>API: Check role and course ownership
  API->>DB: Persist curriculum
  DB-->>API: Saved records
  API-->>UI: Course and lesson data
  Teacher->>UI: Publish course
  UI->>API: PUT course status=PUBLISHED
  API->>DB: Update course status
  Note over UI,API: Course management currently has no Gemini call.
```

### 3. Assignment generation and publication
```mermaid
sequenceDiagram
  actor Teacher
  participant UI as React Assignment UI
  participant API as Assignment API
  participant Gemini as Gemini API
  participant DB as Assignment database
  Teacher->>UI: Request AI assignment draft
  UI->>API: POST generate(topic, difficulty, course)
  API->>DB: Verify course ownership and load subject
  API->>Gemini: Generate Vietnamese draft and rubric
  Gemini-->>API: Draft content
  API-->>UI: Draft for teacher review
  Teacher->>UI: Edit and save draft
  UI->>API: POST assignment with rubric
  API->>DB: Validate and persist DRAFT
  Teacher->>UI: Publish
  UI->>API: POST publish
  API->>DB: Set PUBLISHED
```

### 4. SePay enrollment payment
```mermaid
sequenceDiagram
  actor Student
  participant UI as React Student UI
  participant API as Enrollment API
  participant DB as AMS database
  participant Bank as Student bank
  participant SePay as SePay webhook
  Student->>UI: Enroll in paid course
  UI->>API: POST enrollment
  API->>DB: Create pending payment and enrollment
  API-->>UI: QR and transfer reference
  Student->>Bank: Transfer course fee
  Bank->>SePay: Incoming transaction
  SePay->>API: Signed payment webhook
  API->>API: Verify signature and payment fields
  API->>DB: Activate enrollment if valid
  API-->>UI: Enrollment becomes ACTIVE on refresh
```

### 5. Submission evaluation and teacher review
```mermaid
sequenceDiagram
  actor Student
  actor Teacher
  participant UI as React Assignment UI
  participant API as Submission API
  participant Gemini as Gemini API
  participant DB as Submission database
  Student->>UI: Submit file or quiz answers
  UI->>API: POST multipart submission
  API->>DB: Verify active enrollment and deadline; save attempt
  alt Document assignment
    API->>Gemini: Evaluate extracted evidence using rubric
    Gemini-->>API: Suggested score and feedback
  else Quiz
    API->>API: Score against answer key
  end
  API->>DB: Save result or AI_FAILED
  API-->>UI: Submission state and result
  Teacher->>UI: Review queue and set official score
  UI->>API: PATCH review
  API->>DB: Save teacher score and feedback
  API-->>UI: TEACHER_REVIEWED result
```

## 4. Shared system diagrams

### System context
```mermaid
flowchart LR
  Student[Student] <--> AMS[AMS Course Management]
  Teacher[Teacher] <--> AMS
  Admin[Admin] <--> AMS
  AMS <--> Google[Google Identity]
  AMS --> Mail[Mail service]
  AMS <--> SePay[SePay payment webhook]
  AMS <--> Gemini[Gemini API]
  AMS <--> DB[(MySQL / H2)]
```

### Entity class diagram
```mermaid
classDiagram
  User "1" --> "0..*" Course : teaches
  Course "1" *-- "0..*" CourseModule
  CourseModule "1" *-- "0..*" Lesson
  Course "1" --> "0..*" Enrollment
  User "1" --> "0..*" Enrollment : student
  Enrollment "1" --> "0..*" Payment
  Course "1" --> "0..*" Assignment
  Assignment "1" --> "0..*" Submission
  User "1" --> "0..*" Submission : student
  Submission "1" *-- "0..*" SubmissionFile
  class User { userId role email }
  class Course { courseId courseCode title subject price status }
  class CourseModule { moduleId title orderIndex }
  class Lesson { lessonId title orderIndex }
  class Enrollment { enrollmentId status createdAt }
  class Payment { paymentId amount status expiresAt }
  class Assignment { id title assignmentType status dueDate maxScore gradingRubric }
  class Submission { id attemptNumber status aiScore teacherScore submittedAt }
  class SubmissionFile { id originalName storageKey sizeBytes }
```

### State transition diagram
```mermaid
stateDiagram-v2
  state Enrollment {
    [*] --> PENDING: Paid course selected
    [*] --> ACTIVE: Free course selected
    PENDING --> ACTIVE: Verified payment
    PENDING --> EXPIRED: Payment deadline passed
    EXPIRED --> PENDING: New payment attempt
  }
  state Submission {
    [*] --> SUBMITTED
    SUBMITTED --> EVALUATED: AI or quiz grader succeeds
    SUBMITTED --> AI_FAILED: AI/extraction fails
    AI_FAILED --> EVALUATED: Retry succeeds
    AI_FAILED --> TEACHER_REVIEWED: Manual review
    EVALUATED --> TEACHER_REVIEWED: Teacher confirms result
  }
```

### System architecture
```mermaid
flowchart TB
  Browser[React + Vite frontend]
  Security[Spring Security + JWT]
  Auth[Auth module]
  Courses[Course management module]
  Enrollment[Enrollment and SePay module]
  Assignments[Assignment and submission module]
  Persistence[Spring Data JPA]
  Database[(MySQL / H2)]
  Google[Google Identity]
  Mail[Mail service]
  SePay[SePay]
  Gemini[Gemini API]
  Browser -->|REST /api| Security
  Security --> Auth
  Security --> Courses
  Security --> Enrollment
  Security --> Assignments
  Auth --> Google
  Auth --> Mail
  Enrollment <--> SePay
  Assignments <--> Gemini
  Courses --> Persistence
  Enrollment --> Persistence
  Assignments --> Persistence
  Auth --> Persistence
  Persistence --> Database
```

### Database design
```mermaid
erDiagram
  USERS ||--o{ COURSES : teaches
  USERS ||--o{ COURSE_ENROLLMENTS : student
  COURSES ||--o{ COURSE_ENROLLMENTS : enrolls
  COURSE_ENROLLMENTS ||--o{ PAYMENTS : payment_attempts
  COURSES ||--o{ COURSE_MODULES : contains
  COURSE_MODULES ||--o{ LESSONS : contains
  COURSES ||--o{ ASSIGNMENTS : owns
  USERS ||--o{ SUBMISSIONS : submits
  ASSIGNMENTS ||--o{ SUBMISSIONS : receives
  SUBMISSIONS ||--o{ SUBMISSION_FILES : attaches
  USERS { int user_id PK string email string role }
  COURSES { int course_id PK int teacher_id FK string course_code string status decimal price }
  COURSE_ENROLLMENTS { int enrollment_id PK int student_id FK int course_id FK string status }
  PAYMENTS { int payment_id PK int enrollment_id FK decimal amount string status datetime expires_at }
  COURSE_MODULES { int module_id PK int course_id FK string title int order_index }
  LESSONS { int lesson_id PK int module_id FK string title int order_index }
  ASSIGNMENTS { int id PK int subject_id FK string title string assignment_type string status datetime due_date }
  SUBMISSIONS { int id PK int assignment_id FK int student_id FK int attempt_number string status decimal ai_score decimal teacher_score }
  SUBMISSION_FILES { int id PK int submission_id FK string original_name string storage_key bigint size_bytes }
```

## 5. Five class diagrams (member allocation)

### Member 1 — Login System
```mermaid
classDiagram
  AuthController --> AuthService
  AuthService --> UserRepository
  AuthService --> JwtTokenProvider
  AuthService --> GoogleTokenVerifier
  AuthService --> EmailService
  class User { userId email passwordHash role status }
```

### Member 2 — Manage Courses
```mermaid
classDiagram
  CourseController --> CourseManagementService
  CourseStructureController --> CourseManagementService
  CourseManagementService --> CourseRepository
  CourseManagementService --> CourseModuleRepository
  CourseManagementService --> LessonRepository
  Course "1" *-- "many" CourseModule
  CourseModule "1" *-- "many" Lesson
```

### Member 3 — Manage Subject Assignments
```mermaid
classDiagram
  AssignmentController --> AssignmentService
  AiAssignmentController --> GeminiAiService
  AssignmentService --> AssignmentRepository
  AssignmentService --> AssignmentTemplateRepository
  Assignment "1" --> "many" Criterion : rubric JSON
  Assignment "1" --> "many" Question : optional quiz JSON
```

### Member 4 — Enrollment and Payment
```mermaid
classDiagram
  EnrollmentController --> EnrollmentService
  SepayWebhookController --> SepayWebhookService
  EnrollmentService --> EnrollmentRepository
  EnrollmentService --> PaymentRepository
  SepayWebhookService --> SepayTransactionRepository
  Enrollment "1" --> "many" Payment
  Enrollment --> EnrollmentStatus
  Payment --> PaymentStatus
```

### Member 5 — Submit and Evaluate
```mermaid
classDiagram
  SubmissionController --> SubmissionService
  SubmissionService --> SubmissionRepository
  SubmissionService --> SubmissionFileStorage
  SubmissionService --> SubmissionTextExtractor
  SubmissionService --> GeminiAiService
  Submission "1" *-- "many" SubmissionFile
  Submission --> SubmissionStatus
```

## Implementation status notes

- Course management, student course enrollment/payment access, auth, Gemini assignment drafting and backend submission/evaluation APIs already exist.
- Student dashboard now exposes assignments and supports submission/history/results. Teacher assignment detail now exposes the submission queue, retry, file access and score/feedback review.
- Course management currently has no Gemini integration; the course activity/sequence diagrams intentionally describe its current CRUD/publication flow.
- Payment and Gemini live integrations require environment credentials and external service configuration; local automated tests use controlled fixtures/mocks.
