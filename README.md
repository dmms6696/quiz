# 우리 반 퀴즈 배틀

학생들이 직접 참여 자료를 만들고, 교사가 실시간으로 진행하는 학급 게임형 웹앱입니다.

지원 모드:

1. 자기소개 퀴즈 배틀: 학생이 자기소개 4지선다 문제를 만들고 친구들이 풉니다.
2. 칭찬 스무고개: 학생이 특정 친구에 대한 칭찬 단서를 만들고 친구들이 대상과 작성자를 추리합니다.
3. 교실 마피아 게임: 역할 확인, 밤 행동, 낮 토론, 투표를 패드로 진행합니다.

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
const MAX_COMPLIMENTS_PER_STUDENT = 3;
const COMPLIMENT_TARGET_POINTS = [1000, 800, 600, 400, 200];
const COMPLIMENT_AUTHOR_BONUS = 300;
const COMPLIMENT_TARGET_BONUS = 200;
const ALLOW_SOLVE_OWN_QUESTION = true;
const AUTO_REVEAL_WHEN_TIME_UP = true;
const DEFAULT_MAFIA_COUNT = 2;
const DEFAULT_POLICE_COUNT = 1;
const DEFAULT_DOCTOR_COUNT = 1;
const DEFAULT_DISCUSSION_SECONDS = 180;
const VOTE_TIE_RULE = "revote_then_skip";
const REVEAL_ROLE_ON_ELIMINATION = true;
const GHOST_BINGO_REQUIRED_CONDITIONS = 8;
const GHOST_CHAT_MAX_LENGTH = 100;
const GHOST_CHAT_COOLDOWN_MS = 1000;
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
    mode: quiz | compliment | mafia
    status: waiting | playing | result | targetReveal | authorGuess | authorReveal
            roleAssigned | roleReveal | nightAction | nightResult
            discussion | voting | voteResult | roleRevealDead | finished
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

    mafia
      round
      settings
        mafiaCount
        policeCount
        doctorCount
        discussionSeconds
        voteTieRule
      students
        studentId
          name
          role: mafia | citizen | police | doctor
          team: mafia | citizen
          alive
      rounds
        roundNumber
          nightActions
            mafia | police | doctor | citizen
          nightResult
          votes
          voteResult
      winner: mafia | citizen
      ghosts
        studentId
          name
          role
          joinedAt
          bingoConfirmed
          selectedIds
          board
          checked
          bingoLines
          checkedCount
          firstBingoAt
      ghostChat
        messageId
          playerId
          playerName
          content
          messageType: user | system
          createdAt
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
3. 칭찬 카드는 서로 다른 친구 기준으로 최대 3명까지 만들 수 있고, 각 카드마다 칭찬 단서를 4개 이상 입력합니다. 5번째 단서는 선택입니다.
4. 게임이 시작되면 공개된 단서를 보고 칭찬 대상을 추리합니다.
5. 한 단서 단계에서는 한 번만 추리할 수 있습니다.
6. 틀렸다면 다음 단서가 공개된 뒤 다시 추리할 수 있습니다.
7. 대상이 공개되면 작성자를 추리합니다.
8. 내가 작성한 칭찬 카드는 맞힐 수 없습니다.

## 7. 교실 마피아 게임 사용 방법

교사:

1. 교사로 입장합니다.
2. 게임 모드에서 교실 마피아 게임을 선택합니다.
3. 방 코드를 학생들에게 알려 줍니다.
4. 마피아, 경찰, 의사 인원을 확인하고 설정 저장을 누릅니다.
5. 역할 배정을 누릅니다.
6. 역할 확인 시작을 눌러 학생들이 자기 역할을 확인하게 합니다.
7. 밤 행동 시작을 누릅니다.
8. 모든 생존자가 패드에서 한 명을 선택하면 밤 결과 계산, 낮 결과 발표를 누릅니다.
9. 토론 시작을 눌러 낮 토론을 진행합니다.
10. 투표 시작, 투표 결과 공개, 정체 공개 순서로 진행합니다.
11. 승리 조건이 충족되지 않으면 다음 밤으로 넘어갑니다.
12. 사망자가 생기면 교사 화면의 유령 빙고 현황과 유령 채팅에서 사망자 활동을 확인할 수 있습니다.

학생:

1. 방 코드와 이름으로 입장합니다.
2. 자기 역할을 확인하되 다른 친구에게 보여 주지 않습니다.
3. 밤 행동 시간에는 생존자 중 한 명을 선택합니다. 의사는 자기 자신도 보호할 수 있고, 다른 역할은 자기 자신을 선택할 수 없습니다.
4. 경찰은 자기 화면에서만 조사 결과를 확인합니다.
5. 마피아는 같은 마피아와 서로의 선택 현황을 볼 수 있습니다.
6. 낮 토론 시간에만 말로 추리합니다.
7. 투표 시간에는 생존자 중 한 명에게 비밀 투표합니다.
8. 탈락자는 즉시 유령 모드로 이동합니다. 이후 말하거나 투표할 수 없고, 유령 빙고와 유령 채팅에 참여합니다.
9. 유령 빙고는 조건 8개를 직접 고르고, 가운데 FREE 칸을 제외한 8칸에 원하는 위치로 배치한 뒤 확정합니다.
10. 확정 이후 발생한 실제 밤 결과와 낮 투표 결과만 자동 체크됩니다.
11. 유령 채팅은 본인이 유령이 된 이후 메시지만 보이고, 교사는 전체 채팅을 실시간으로 확인합니다.
12. 탈락 정체 공개는 마피아 또는 시민으로만 표시됩니다. 경찰과 의사는 시민으로 공개됩니다.

유령 빙고 조건:

- 투표 동점: 낮 투표에서 공동 최다 득표자가 발생
- 과반 득표: 한 명이 전체 유효표의 과반수 득표
- 1표 차 승부: 최다 득표자가 1표 차이로 결정
- 표가 넓게 흩어짐: 4명 이상이 1표 이상 득표
- 처형 없음: 낮 투표에서 아무도 처형되지 않음
- 연속 최다 득표: 같은 플레이어가 두 번 연속 최다 득표
- 계속 의심받는 사람: 같은 플레이어가 두 번 연속 1표 이상 득표
- 새 유령 등장: 새로운 탈락자 발생
- 경찰 사망
- 의사 사망
- 마피아 사망
- 시민팀 사망
- 생존자 5명 이하
- 시민팀 연속 사망
- 마피아 처형
- 밤의 희생자: 밤 결과에서 사망자 발생
- 밤의 평화: 밤 결과에서 사망자 없음
- 5표 집중
- 외로운 한 표들: 3명 이상이 정확히 1표씩 득표
- 압도적 지목: 최다 득표자와 2위의 표 차이가 3표 이상

## 8. 초기화 버튼 차이

- 게임 초기화: 점수와 답변, 진행 상태, 마피아 유령 목록, 유령 빙고, 유령 채팅을 지웁니다. 학생 목록과 제출 자료는 유지됩니다.
- 학생/자료 목록 초기화: 학생 목록, 문제 목록, 칭찬 카드, 마피아 진행 데이터, 유령 데이터, 답변, 점수, 진행 상태를 모두 지웁니다.

## 9. 보안 주의사항

현재 MVP는 정적 웹앱이고 Realtime Database를 방 단위로 구독합니다. 그래서 생존자 화면에는 유령 채팅 UI를 렌더링하지 않지만, Firebase 규칙과 인증을 세밀하게 나누지 않는 한 개발자 도구 수준에서 데이터를 완전히 숨기는 구조는 아닙니다.

실제 장기 운영용으로 강화하려면 Firebase Authentication으로 학생/교사 계정을 구분하고, 유령 채팅을 별도 경로로 분리한 뒤 사망자와 교사만 읽을 수 있는 보안 규칙 또는 Cloud Functions 검증을 추가하세요.

## 10. 로컬 테스트 방법

미리보기 서버는 자동으로 실행하지 않았습니다. 파일을 받은 뒤 원하는 포트로 직접 정적 서버를 실행하세요.

```bash
python -m http.server 5500
```

브라우저에서 `http://localhost:5500`으로 접속합니다.

## 11. 배포 방법

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

## 12. 나중에 추가하면 좋은 기능

- 교사용 QR 코드 자동 생성
- Firebase Authentication 기반 교사 권한 분리
- App Check 적용
- 칭찬 카드 익명성 수준 설정
- 마피아 정체 비공개 모드
- 마피아 재투표 세부 규칙
- 유령 채팅 메시지 삭제 또는 채팅 잠금
- 교사용 마피아 진행 로그 다운로드
- 부적절한 단어 자동 경고
- 결과 CSV 다운로드
- 방 만료 시간 설정
- 학생 이름 중복 감지 강화
