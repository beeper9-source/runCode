# 런닝앱 설계서

## 1. 시스템 개요

### 1.1 목적
조직 내 러닝 활동을 체계적으로 관리하고, 개인 기록 추적 및 팀 미션 수행을 지원하는 웹 기반 애플리케이션

### 1.2 주요 기능
- 회원 정보 관리
- 개인 러닝 기록 관리
- 주간 미션 관리

---

## 2. 데이터베이스 설계

### 2.1 ERD (Entity Relationship Diagram)

```
[회원(rc_Member)] 1 ─────── N [런닝기록(rc_RunningRecord)]
     │
     └─ 조편성(rTeam): A~F

[주간미션(rc_WeeklyMission)] 
```

### 2.2 테이블 상세 설계

#### 2.2.1 회원(rc_Member) 테이블
| 컬럼명 | 데이터타입 | 제약조건 | 설명 |
|--------|-----------|---------|------|
| member_id | INT | PK, AUTO_INCREMENT | 회원 고유 ID |
| name | VARCHAR(50) | NOT NULL | 회원 이름 |
| department | VARCHAR(50) | NOT NULL | 소속 부서명 |
| best_10km | TIME | NULL | 10km 최고 기록 (HH:MM:SS) |
| best_half | TIME | NULL | 하프 마라톤 최고 기록 |
| best_full | TIME | NULL | 풀 마라톤 최고 기록 |
| team | ENUM('A','B','C','D','E','F') | NOT NULL | 조편성 (A~F) |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | 등록일시 |
| updated_at | DATETIME | ON UPDATE CURRENT_TIMESTAMP | 수정일시 |

**인덱스:**
- PRIMARY KEY (member_id)
- INDEX idx_name (name)
- INDEX idx_team (team)

#### 2.2.2 런닝기록(rc_RunningRecord) 테이블
| 컬럼명 | 데이터타입 | 제약조건 | 설명 |
|--------|-----------|---------|------|
| record_id | INT | PK, AUTO_INCREMENT | 기록 고유 ID |
| member_id | INT | FK, NOT NULL | 회원 ID |
| running_date | DATE | NOT NULL | 런닝 날짜 |
| distance | DECIMAL(5,2) | NOT NULL | 런닝 거리(km) |
| running_time | TIME | NOT NULL | 러닝 시간 (HH:MM:SS) |
| pace | TIME | COMPUTED | 페이스 (분/km) - 자동계산 |
| memo | TEXT | NULL | 메모 |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | 등록일시 |
| updated_at | DATETIME | ON UPDATE CURRENT_TIMESTAMP | 수정일시 |

**인덱스:**
- PRIMARY KEY (record_id)
- FOREIGN KEY (member_id) REFERENCES Member(member_id)
- INDEX idx_member_date (member_id, running_date)
- INDEX idx_date (running_date)

**페이스 계산 로직:**
```
페이스(분/km) = 러닝시간(분) / 거리(km)
예: 50분에 10km → 5분/km
```

#### 2.2.3 주간미션(rc_WeeklyMission) 테이블
| 컬럼명 | 데이터타입 | 제약조건 | 설명 |
|--------|-----------|---------|------|
| mission_id | INT | PK, AUTO_INCREMENT | 미션 고유 ID |
| week_number | INT | NOT NULL | 주차 (예: 1, 2, 3...) |
| year | INT | NOT NULL | 년도 |
| title | VARCHAR(100) | NOT NULL | 미션 제목 |
| description | TEXT | NULL | 미션 설명 |
| target_distance | DECIMAL(5,2) | NULL | 목표 거리(km) |
| start_date | DATE | NOT NULL | 시작일 |
| end_date | DATE | NOT NULL | 종료일 |
| is_active | BOOLEAN | DEFAULT TRUE | 활성화 여부 |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | 등록일시 |
| updated_at | DATETIME | ON UPDATE CURRENT_TIMESTAMP | 수정일시 |

**인덱스:**
- PRIMARY KEY (mission_id)
- UNIQUE KEY uk_year_week (year, week_number)
- INDEX idx_date_range (start_date, end_date)

---

## 3. API 설계

### 3.1 회원관리 API

#### 3.1.1 회원 등록
```
POST /api/members
Content-Type: application/json

Request Body:
{
  "name": "홍길동",
  "department": "개발팀",
  "team": "A"
}

Response (201 Created):
{
  "success": true,
  "data": {
    "member_id": 1,
    "name": "홍길동",
    "department": "개발팀",
    "team": "A",
    "best_10km": null,
    "best_half": null,
    "best_full": null,
    "created_at": "2025-11-13T10:00:00Z"
  }
}
```

#### 3.1.2 회원 목록 조회
```
GET /api/members?team=A&page=1&limit=20

Response (200 OK):
{
  "success": true,
  "data": {
    "members": [...],
    "pagination": {
      "current_page": 1,
      "total_pages": 5,
      "total_count": 100
    }
  }
}
```

#### 3.1.3 회원 상세 조회
```
GET /api/members/{member_id}

Response (200 OK):
{
  "success": true,
  "data": {
    "member_id": 1,
    "name": "홍길동",
    "department": "개발팀",
    "team": "A",
    "best_10km": "00:45:30",
    "best_half": "01:35:00",
    "best_full": null
  }
}
```

#### 3.1.4 회원 정보 수정
```
PUT /api/members/{member_id}
Content-Type: application/json

Request Body:
{
  "name": "홍길동",
  "department": "개발팀",
  "team": "B",
  "best_10km": "00:45:30"
}

Response (200 OK):
{
  "success": true,
  "data": { ... }
}
```

#### 3.1.5 회원 삭제
```
DELETE /api/members/{member_id}

Response (200 OK):
{
  "success": true,
  "message": "회원이 삭제되었습니다."
}
```

---

### 3.2 런닝기록 API

#### 3.2.1 기록 등록
```
POST /api/running-records
Content-Type: application/json

Request Body:
{
  "member_id": 1,
  "running_date": "2025-11-13",
  "distance": 10.5,
  "running_time": "00:52:30",
  "memo": "날씨 좋음, 컨디션 양호"
}

Response (201 Created):
{
  "success": true,
  "data": {
    "record_id": 1,
    "member_id": 1,
    "running_date": "2025-11-13",
    "distance": 10.5,
    "running_time": "00:52:30",
    "pace": "00:05:00",
    "memo": "날씨 좋음, 컨디션 양호",
    "is_personal_best": true,
    "distance_category": "10km"
  }
}
```

#### 3.2.2 기록 목록 조회
```
GET /api/running-records?member_id=1&start_date=2025-11-01&end_date=2025-11-30

Response (200 OK):
{
  "success": true,
  "data": {
    "records": [...],
    "statistics": {
      "total_distance": 125.5,
      "total_time": "10:30:00",
      "average_pace": "00:05:02",
      "run_count": 12
    }
  }
}
```

#### 3.2.3 기록 상세 조회
```
GET /api/running-records/{record_id}

Response (200 OK):
{
  "success": true,
  "data": { ... }
}
```

#### 3.2.4 기록 수정
```
PUT /api/running-records/{record_id}
Content-Type: application/json

Request Body:
{
  "distance": 10.8,
  "running_time": "00:54:00",
  "memo": "수정된 메모"
}

Response (200 OK):
{
  "success": true,
  "data": { ... }
}
```

#### 3.2.5 기록 삭제
```
DELETE /api/running-records/{record_id}

Response (200 OK):
{
  "success": true,
  "message": "기록이 삭제되었습니다."
}
```

---

### 3.3 주간미션 API

#### 3.3.1 미션 등록
```
POST /api/weekly-missions
Content-Type: application/json

Request Body:
{
  "week_number": 46,
  "year": 2025,
  "title": "11월 셋째 주 단체 런닝",
  "description": "이번 주 목표: 전체 조원 평균 20km 달성",
  "target_distance": 20.0,
  "start_date": "2025-11-10",
  "end_date": "2025-11-16"
}

Response (201 Created):
{
  "success": true,
  "data": { ... }
}
```

#### 3.3.2 미션 목록 조회
```
GET /api/weekly-missions?year=2025&is_active=true

Response (200 OK):
{
  "success": true,
  "data": {
    "missions": [...]
  }
}
```

#### 3.3.3 미션 상세 조회
```
GET /api/weekly-missions/{mission_id}

Response (200 OK):
{
  "success": true,
  "data": {
    "mission_id": 1,
    "week_number": 46,
    "year": 2025,
    "title": "11월 셋째 주 단체 런닝",
    "progress": {
      "team_progress": [
        {
          "team": "A",
          "total_distance": 245.5,
          "member_count": 12,
          "average_distance": 20.46,
          "achievement_rate": 102.3
        },
        ...
      ]
    }
  }
}
```

#### 3.3.4 미션 수정
```
PUT /api/weekly-missions/{mission_id}

Response (200 OK):
{
  "success": true,
  "data": { ... }
}
```

#### 3.3.5 미션 삭제
```
DELETE /api/weekly-missions/{mission_id}

Response (200 OK):
{
  "success": true,
  "message": "미션이 삭제되었습니다."
}
```

---

## 4. 비즈니스 로직

### 4.1 개인 베스트 기록 자동 갱신
런닝 기록 등록/수정 시 다음 로직 실행:

```python
def update_personal_best(member_id, distance, running_time):
    # 거리 범위별 카테고리 판정
    if 9.5 <= distance <= 10.5:
        category = '10km'
        current_best = get_member_best_10km(member_id)
    elif 20.5 <= distance <= 21.5:
        category = 'half'
        current_best = get_member_best_half(member_id)
    elif 41.5 <= distance <= 43.0:
        category = 'full'
        current_best = get_member_best_full(member_id)
    else:
        return False
    
    # 기존 기록보다 빠른 경우 업데이트
    if current_best is None or running_time < current_best:
        update_member_best(member_id, category, running_time)
        return True
    return False
```

### 4.2 페이스 자동 계산
```python
def calculate_pace(distance_km, running_time):
    """
    페이스 계산: 1km당 소요 시간
    
    Args:
        distance_km: 거리 (km)
        running_time: 시간 (HH:MM:SS)
    
    Returns:
        pace: 페이스 (MM:SS per km)
    """
    total_seconds = time_to_seconds(running_time)
    pace_seconds = total_seconds / distance_km
    return seconds_to_time(pace_seconds)

# 예시: 10km를 50분에 완주 → 5분/km
```

### 4.3 주간미션 진행률 계산
```python
def calculate_mission_progress(mission_id):
    mission = get_mission(mission_id)
    teams = ['A', 'B', 'C', 'D', 'E', 'F']
    
    progress = []
    for team in teams:
        members = get_team_members(team)
        records = get_records_in_period(
            members, 
            mission.start_date, 
            mission.end_date
        )
        
        total_distance = sum(r.distance for r in records)
        member_count = len(members)
        average_distance = total_distance / member_count if member_count > 0 else 0
        achievement_rate = (average_distance / mission.target_distance) * 100
        
        progress.append({
            'team': team,
            'total_distance': total_distance,
            'member_count': member_count,
            'average_distance': average_distance,
            'achievement_rate': achievement_rate
        })
    
    return progress
```

---

## 5. 화면 설계

### 5.1 회원 관리 화면

#### 5.1.1 회원 목록
- **경로**: `/members`
- **구성요소**:
  - 조별 필터 (A~F조, 전체)
  - 검색바 (이름, 부서)
  - 회원 테이블 (이름, 부서, 조, 10km 베스트, 하프 베스트, 풀 베스트)
  - 회원 등록 버튼

#### 5.1.2 회원 등록/수정 폼
- **경로**: `/members/new`, `/members/{id}/edit`
- **입력 필드**:
  - 이름 (필수)
  - 부서명 (필수)
  - 조편성 (드롭다운: A~F, 필수)
  - 10km 베스트 (선택, 시간 입력)
  - 하프 베스트 (선택, 시간 입력)
  - 풀코스 베스트 (선택, 시간 입력)

---

### 5.2 런닝 기록 화면

#### 5.2.1 기록 목록/대시보드
- **경로**: `/records`
- **구성요소**:
  - 기간 필터 (이번 주, 이번 달, 사용자 지정)
  - 회원 선택 (본인 또는 전체 조회)
  - 통계 카드:
    - 총 거리
    - 총 시간
    - 평균 페이스
    - 런닝 횟수
  - 기록 테이블 (날짜, 거리, 시간, 페이스, 메모)
  - 기록 등록 버튼

#### 5.2.2 기록 등록/수정 폼
- **경로**: `/records/new`, `/records/{id}/edit`
- **입력 필드**:
  - 날짜 (날짜 선택기, 필수)
  - 거리 (km, 숫자 입력, 필수)
  - 시간 (HH:MM:SS 입력, 필수)
  - 페이스 (자동 계산되어 표시, 읽기 전용)
  - 메모 (텍스트 영역, 선택)

#### 5.2.3 기록 상세
- **경로**: `/records/{id}`
- **표시 정보**:
  - 모든 기록 정보
  - 개인 베스트 갱신 여부 뱃지
  - 수정/삭제 버튼

---

### 5.3 주간 미션 화면

#### 5.3.1 미션 목록
- **경로**: `/missions`
- **구성요소**:
  - 연도 필터
  - 활성/비활성 필터
  - 미션 카드 리스트:
    - 주차
    - 제목
    - 기간
    - 목표 거리
    - 전체 달성률
  - 미션 등록 버튼 (관리자)

#### 5.3.2 미션 상세
- **경로**: `/missions/{id}`
- **표시 정보**:
  - 미션 정보 (제목, 설명, 기간, 목표)
  - 조별 진행 현황:
    - 조명
    - 총 거리
    - 평균 거리
    - 달성률 (프로그레스 바)
  - 조별 순위

#### 5.3.3 미션 등록/수정 폼
- **경로**: `/missions/new`, `/missions/{id}/edit`
- **입력 필드**:
  - 년도 (숫자, 필수)
  - 주차 (숫자, 필수)
  - 제목 (텍스트, 필수)
  - 설명 (텍스트 영역, 선택)
  - 목표 거리 (km, 숫자, 선택)
  - 시작일 (날짜 선택기, 필수)
  - 종료일 (날짜 선택기, 필수)
  - 활성화 여부 (체크박스)

---

## 6. 기술 스택 권장사항

- **언어/프레임워크**: 
  -html,css,java script
- **데이터베이스**: 
   supbase

