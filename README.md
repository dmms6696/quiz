# 우리 반 퀴즈 배틀

학생들이 직접 참여 자료를 만들고, 교사가 실시간으로 진행하는 학급 게임형 웹앱입니다.

지원 모드:

1. 자기소개 퀴즈 배틀: 학생이 자기소개 4지선다 문제를 만들고 친구들이 풉니다.
2. 칭찬 스무고개: 학생이 특정 친구에 대한 칭찬 단서를 만들고 친구들이 대상과 작성자를 추리합니다.

## 1. 파일 구조

```text
class-quiz-battle/
├─ index.html
├─ style.css
├─ app.js
├─ firebase-rules.json
└─ README.md
```

## 2. 주요 설정값

`app.js` 상단에서 바꿀 수 있습니다.

```js
const TEACHER_PASSWORD = "1234";
const DEFAULT_TIME_LIMIT_SECONDS = 20;
const MAX_QUESTIONS_PER_STUDENT = 3;
const COMPLIMENT_TARGET_POINTS = [1000, 800, 600, 400, 200];
const COMPLIMENT_AUTHOR_BONUS = 300;
const COMPLIMENT_TARGET_BONUS = 200;
const ALLOW_SOLVE_OWN_QUESTION = true;
const AUTO_REVEAL_WHEN_TIME_UP = true;
```

칭찬 카드 단서가 4개인 경우에는 `COMPLIMENT_TARGET_POINTS`의 앞 4개 점수만 사용합니다.

## 3. Firebase 설정 방법

1. Firebase Console에서 새 프로젝트를 만듭니다.
2. Build > Realtime Database를 선택합니다.
3. 데이터베이스를 만들고 위치를 선택합니다.
4. Project settings > General > Your apps에서 Web 앱을 추가합니다.
5. SDK 설정값을 복사해서 `app.js` 상단의 `firebaseConfig`에 붙여 넣습니다.
6. Realtime Database 화면의 URL이 `databaseURL`에 들어갔는지 확인합니다.
7. Rules 탭에 `firebase-rules.json` 내용을 붙여 넣습니다.

주의: 이 MVP의 교사 비밀번호는 정적 코드 안에 있으므로 완전한 보안 장치가 아닙니다. 실제 공개 서비스로 쓰려면 Firebase Authentication, 교사용 계정, 서버 검증 또는 Cloud Functions를 추가하세요.

## 4. Firebase 데이터 구조

```text
rooms
  roomCode
    mode: quiz | compliment
    status: waiting | playing | result | targetReveal | authorGuess | authorReveal | finished
    students
      studentId
        name
        score
        connected

    questions
      questionId
        authorName
        question
        choices
        correctIndex
    answers
      questionId
        studentId
          selectedIndex
          isCorrect
          scoreEarned

    compliments
      complimentId
        authorStudentId
        authorName
        targetStudentId
        targetName
        clues
    complimentOrder
      0: complimentId
    complimentAnswers
      complimentId
        targetGuesses
        authorGuesses
    complimentBonuses
      target
        complimentId
          targetStudentId
          scoreEarned
```

## 5. 자기소개 퀴즈 배틀 사용 방법

교사:

1. 교사로 입장합니다.
2. 게임 모드에서 자기소개 퀴즈 배틀을 선택합니다.
3. 방 코드를 학생들에게 알려 줍니다.
4. 제출 문제 수와 학생 목록을 확인합니다.
5. 게임 시작을 누릅니다. 문제 순서는 자동으로 랜덤하게 섞입니다.
6. 문제마다 정답 공개, 다음 문제를 진행합니다.
7. 마지막에 최종 랭킹을 확인합니다.

학생:

1. 방 코드와 이름으로 입장합니다.
2. 자기 자신에 대한 4지선다 문제를 최대 3개까지 만듭니다.
3. 게임이 시작되면 선택지를 눌러 답합니다.
4. 문제별 결과와 누적 점수를 확인합니다.

## 6. 칭찬 스무고개 사용 방법

교사:

1. 교사로 입장합니다.
2. 게임 모드에서 칭찬 스무고개를 선택합니다.
3. 방 코드를 학생들에게 알려 줍니다.
4. 학생들이 칭찬 카드를 제출할 때까지 기다립니다.
5. 제출된 칭찬 카드 목록을 확인하고, 부적절한 카드는 삭제합니다.
6. 게임 시작을 누릅니다. 칭찬 카드 순서는 자동으로 랜덤하게 섞입니다.
7. 첫 단서가 공개되면 학생들이 칭찬 대상을 추리합니다.
8. 다음 단서 공개를 눌러 단서를 하나씩 늘립니다.
9. 적절한 시점에 칭찬 대상 공개를 누릅니다.
10. 작성자 추리 시작을 누릅니다.
11. 작성자 공개를 누르면 카드 결과와 누적 랭킹을 확인할 수 있습니다.
12. 다음 칭찬으로 이동합니다.
13. 모든 카드가 끝나면 최종 랭킹을 봅니다.

학생:

1. 방 코드와 이름으로 입장합니다.
2. 칭찬할 친구를 선택합니다. 자기 자신은 선택할 수 없습니다.
3. 칭찬 단서를 4개 이상 입력합니다. 5번째 단서는 선택입니다.
4. 게임이 시작되면 공개된 단서를 보고 칭찬 대상을 추리합니다.
5. 한 단서 단계에서는 한 번만 추리할 수 있습니다.
6. 틀렸다면 다음 단서가 공개된 뒤 다시 추리할 수 있습니다.
7. 대상이 공개되면 작성자를 추리합니다.
8. 내가 작성한 칭찬 카드는 맞힐 수 없습니다.

## 7. 초기화 버튼 차이

- 게임 초기화: 점수와 답변, 진행 상태를 지웁니다. 학생 목록과 제출 자료는 유지됩니다.
- 학생/자료 목록 초기화: 학생 목록, 문제 목록, 칭찬 카드, 답변, 점수, 진행 상태를 모두 지웁니다.

## 8. 로컬 테스트 방법

미리보기 서버는 자동으로 실행하지 않았습니다. 파일을 받은 뒤 원하는 포트로 직접 정적 서버를 실행하세요.

```bash
python -m http.server 5500
```

브라우저에서 `http://localhost:5500`으로 접속합니다.

## 9. 배포 방법

GitHub Pages:

1. `index.html`, `style.css`, `app.js`, `firebase-rules.json`, `README.md`를 저장소에 올립니다.
2. Settings > Pages로 이동합니다.
3. Deploy from a branch를 선택합니다.
4. `main` 브랜치와 `/root`를 선택합니다.
5. 배포 주소를 학생들에게 공유합니다.

Netlify:

1. Add new site > Deploy manually를 선택합니다.
2. 파일이 들어 있는 폴더를 끌어다 놓습니다.
3. 배포 주소를 학생들에게 공유합니다.

## 10. 나중에 추가하면 좋은 기능

- 교사용 QR 코드 자동 생성
- Firebase Authentication 기반 교사 권한 분리
- App Check 적용
- 칭찬 카드 익명성 수준 설정
- 부적절한 단어 자동 경고
- 결과 CSV 다운로드
- 방 만료 시간 설정
- 학생 이름 중복 감지 강화
