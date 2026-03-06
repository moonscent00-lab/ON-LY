# Diary OS 제품 설계 초안

## 1) 제품 목표
- 개인의 흩어진 정보(일정, 할일, 루틴, 기록, 스크랩)를 하나의 흐름에서 관리한다.
- MacBook + iPhone에서 끊김 없이 사용한다.
- 추후 가족/친구와 일정/목표 일부를 공유할 수 있게 확장한다.

## 2) 핵심 모듈
- 캘린더: 일정 조회/등록/수정, 외부 캘린더 연동 고려
- 투두 리스트: 오늘 할 일 중심 정리
- 루틴 체크: 매일 반복되는 습관 체크
- 목표 달성 체크: 수치/사진/운동/식단 기록 + 진행률 시각화
- 인사이트 정리: 독서노트/장소/콘텐츠 스크랩/레시피/위시리스트
- 비전보드: 꿈/장기 목표/관련 자료 저장

## 3) 개발 우선순위 (MVP -> 확장)
1. Today Dashboard
   - 오늘 일정
   - 오늘 할 일
   - 오늘 루틴 체크
2. Goal Tracker
   - 목표 생성
   - 일일 체크인(몸무게/체지방/운동량 등)
   - 사진 업로드
3. Insight Hub
   - 독서노트 + 스크랩 통합
   - 태그/검색
4. Shared Space
   - 가족/친구 초대
   - 공유 캘린더/공유 보드

## 4) 연동 전략
- 1차: 자체 데이터 모델로 빠르게 구현 (DB 중심)
- 2차: 외부 연동 추가
  - Google Calendar (일정)
  - Apple/Google Reminder 연동 검토 (할일)
  - OpenAI API (식단 사진 분석/요약)

## 5) 페이지 구성 제안
1. `/` Today Dashboard
2. `/goals` 목표 관리
3. `/insights` 인사이트 허브
4. `/vision` 비전보드
5. `/settings/integrations` 외부 서비스 연결

## 6) 데이터 모델 초안
- User
- CalendarEvent
- Todo
- Routine
- Goal
- GoalCheckin
- InsightItem
- VisionItem
- SharedMember

## 7) 다음 구현 순서
1. Today Dashboard UI + 로컬 상태
2. DB 스키마(Prisma 또는 Drizzle)
3. Todo/Routine CRUD API
4. 캘린더 월간/주간 뷰
5. Goal Tracker 및 체크인 업로드
