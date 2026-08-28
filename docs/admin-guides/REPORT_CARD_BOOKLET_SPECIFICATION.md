# Sierra Leone Standard Booklet-Style Report Card Specification

> **Document Status**: Official Architecture & Blueprint Specification  
> **Primary Reference Model**: Grace School of Science (Freetown, Sierra Leone Booklet Standard)  
> **Target Module**: Version 2.0 Terminal PDF Report Cards (`/academic/report-cards`)  

---

## 📄 Overview & Physical Format

In Sierra Leone, the vast majority of primary, junior secondary (JSS), and senior secondary (SSS) schools utilize a **4-Page Booklet Fold / 2-Page Wide Spread Report Card** (printed on A4 or A3 cardstock folded down the middle).

This specification details the structural layout, data fields, domain rating categories, dynamic template placeholders, and PDF generation rules for producing 100% compliant Sierra Leone school booklet report cards.

---

## 📐 Layout Structure

```
┌───────────────────────────────────────┬───────────────────────────────────────┐
│              PAGE 4 (BACK COVER)      │             PAGE 1 (FRONT COVER)      │
│                                       │                                       │
│ • Affective Domain Rating Keys (1-12) │ • School Name, Crest & Address        │
│ • Psychomotor Rating Keys (1-12)      │ • Report Card Header (SSS / JSS)      │
│ • 5-Point Rating Scale (1 to 5)       │ • Student Name & Admission Number     │
│ • Cognitive Guidelines & Parent Note  │ • Principal Signature & Stamp Box     │
├───────────────────────────────────────┴───────────────────────────────────────┤
│                                   FOLD                                        │
├───────────────────────────────────────┬───────────────────────────────────────┤
│              PAGE 2 (INNER LEFT)      │             PAGE 3 (INNER RIGHT)      │
│                                       │                                       │
│ • Pupil & Master Header Information   │ • Affective Domain Rating Grid        │
│ • Cognitive Domain Table (Subjects)   │ • Psychomotor Domain Rating Grid      │
│   - Term 1: Test 1, Test 2, Mn, Rnk   │ • Principal Remarks & Comments        │
│   - Term 2: Test 1, Test 2, Mn, Rnk   │ • Promotion Decision (Promoted/Repeat)│
│   - Term 3: Test 1, Test 2, Mn, Rnk   │ • Attendance Summary Log              │
│   - Yearly: Mean, Rank                │ • Principal & Parent Signatures & Date│
└───────────────────────────────────────┴───────────────────────────────────────┘
```

---

## 🏷️ Detailed Section Specifications

### 1. Front Cover (Page 1)
- **School Header**: School Name, Location/Address, Crest/Logo watermark & emblem.
- **Level Banner**: E.g. `SENIOR SECONDARY SCHOOL REPORT CARD — SCIENCE & TECHNOLOGY`.
- **Student Details**:
  - `Name of Pupil`: Full student name
  - `Admission No`: Official student ID
  - `Academic Year`: E.g. `2025 / 2026`
- **Validation**:
  - `Principal's Signature`: Uploaded PNG signature overlay
  - `Official Stamp`: Digital rubber stamp seal overlay

---

### 2. Rating Keys & Domain Legend (Page 4 - Back Cover)

#### A. Affective Domain (12 Categories)
1. **Class Participation**
2. **Sociability**
3. **Helpfulness**
4. **Honesty**
5. **Effort**
6. **Initiative**
7. **Self-Discipline**
8. **Demeanor**
9. **Sportsmanship**
10. **Dependability / Reliability**
11. **Punctuality / Regularity**
12. **School and Community Involvement**

#### B. Psychomotor Domain (12 Categories)
1. **Physical Dexterity**
2. **Stamina**
3. **Physical Agility**
4. **Individual Sporting Prowess (Ball Games)**
5. **Ability to Function as Team Player**
6. **Sporting Prowess in Athletics**
7. **Drawing / Painting (Artistic Skills)**
8. **Handwriting**
9. **Physical Co-ordination (in dance)**
10. **Voice Control (in talking and singing)**
11. **Musical Instrument Playing Skill**
12. **Bodily Control / Sense of Balance**

#### C. Affective & Psychomotor Rating Scale (1 to 5)
- **5 — Great / Exceptional / Always**
- **4 — Good / Often**
- **3 — Some / Fair / Reasonable**
- **2 — Little / Rarely / Poor**
- **1 — Negligible / Never / Very Little / Very Poor**

#### D. Grace School Cognitive Grading Scale (Failing Marks Below 50% in RED)
- **85 – 100%**: `A` — *Excellent*
- **75 – 84%**: `B` — *Very Good*
- **60 – 74%**: `C` — *Good*
- **50 – 59%**: `D` — *Satisfying* (Passing Threshold)
- **Below 50%**: `F` — *Unsatisfying* (**Failing Mark — Displayed in RED**)

#### E. Conduct & Behaviour Legend
- **V.G**: *Very Good*
- **G**: *Good*
- **S**: *Satisfying*
- **PT**: *Play Truant (Must See Principal)*
- **N**: *Neglected Work*
- **ABS**: *Absent*

---

### 3. Cognitive Domain Grid (Page 2 - Inner Left)
- **Header**: Name, Admission No, Form/Class, Average Class Age, Pupil's Age, Teacher in Charge, Academic Year.
- **Table Columns**:
  - `SUBJECT`: English Lang, Maths, Agric Science, Biology, Chemistry, Physics, Further Maths, Eng Science, Prin of Ecoms, CPS, Geography, Technical Drawing, P.H.E, Sci Core, Comb. Scores.
  - `TERM 1`: Test 1, Test 2, Mean (Mn), Rank (Rnk)
  - `TERM 2`: Test 1, Test 2, Mean (Mn), Rank (Rnk)
  - `TERM 3`: Test 1, Test 2, Mean (Mn), Rank (Rnk)
  - `YEARLY`: Mean (Mn), Rank (Rnk)
- **Summary Rows**: Percentages, Position in Class.

---

### 4. Affective & Psychomotor Rating Grids (Page 3 - Inner Right)
- Ratings per category across Test 1, Test 2, Term 3, and Yearly Mean/Rank.

---

### 5. Comments, Automated Attendance & Promotion Decision (Page 3 Footer)
- **Automated Attendance Summary**:
  - Automatically calculates student attendance counts directly from the system's daily attendance logs (`/attendance`) across Term 1, Term 2, and Term 3:
    - `On Time`: Count of days student attended on time (e.g. `134`, `114`, `124`)
    - `Late`: Count of days student arrived late (e.g. `4`, `10`)
    - `Absent`: Count of days student was absent (e.g. `10`, `6`)
    - `Sick / Excused`: Count of medical/excused absences
  - **Zero Manual Counting**: Teachers do not need to tally attendance by hand; the report engine pulls live tallies directly from daily roll call records.
  - `Teacher's Sign and Date`
- **Conduct & Comments**:
  - `Guidance and Counseling / Continuous Assessment Comments`: Term 1, Term 2, Term 3
  - `Principal's Signature and Date`: Term 1, Term 2, Term 3
  - `Principal's End of Year Comments`
  - `Parent's Signature and Date`
- **Promotion Status Box**: `PROMOTED TO / TO REPEAT: ______________`

---

## 🎨 School Customization Options

Every school can configure the following in **Settings → Report Card Template**:
1. **School Branding**: Logo, watermark opacity, header fonts, primary theme color.
2. **Column Configuration**:
   - `Test 1 / Test 2 / Mean` (Grace School model)
   - `MTT / ETT / Mean` (Rising Academy model)
   - `CA 30% / Exam 70% / Total` (Standard SL WASSCE model)
3. **Domain Rating Enable/Disable**: Toggle Affective and Psychomotor rating tables.
4. **Digital Assets**: Principal signature image & rubber stamp seal upload.
