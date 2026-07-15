# 동명중학교 PLAYGROUND

퀴즈, 칭찬, 추리, 게임이 모이는 우리 학교 플레이 공간입니다.

지원 모드:

1. 퀴즈 배틀: 학생이 자기소개 4지선다 문제를 만들고 친구들이 풉니다.
2. 칭찬 스무고개: 학생이 특정 친구에 대한 칭찬 단서를 만들고 친구들이 대상과 작성자를 추리합니다.
3. 교실 마피아 게임: 역할 확인, 밤 행동, 낮 토론, 투표를 패드로 진행합니다.
4. 라이어게임: 비슷한 제시어 속 숨어 있는 라이어를 대화와 투표로 추리합니다.
5. 캐치마인드: 출제자가 그리는 그림을 실시간으로 보고 제시어를 맞힙니다.
6. 자리바꾸기 게임: 비밀 순서로 자리를 고르고 카드 효과를 사용한 뒤 마지막에 자리 주인을 공개합니다.

## 1. 파일 구조

```text
project-root/
├─ index.html                  # outputs/index.html로 이동
├─ outputs/
│  ├─ index.html
│  ├─ style.css
│  ├─ app.js
│  ├─ firebase-rules.json
│  └─ README.md
└─ tests/
   └─ seat-game-smoke.cjs
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
const MAFIA_SELF_SELECT_ALLOWED = false;
const DEFAULT_LIAR_COUNT = 2;
const DEFAULT_CATCHMIND_ROUND_SECONDS = 60;
const DEFAULT_SEAT_ROWS = 5;
const DEFAULT_SEAT_COLUMNS = 3;
const DEFAULT_SEAT_CARD_PHASE_SECONDS = 12;
const GHOST_BINGO_REQUIRED_CONDITIONS = 8;
const GHOST_CHAT_MAX_LENGTH = 100;
const GHOST_CHAT_COOLDOWN_MS = 1000;
```

칭찬 카드 단서가 4개인 경우에는 `COMPLIMENT_TARGET_POINTS`의 앞 4개 점수만 사용합니다.
`MAX_QUESTIONS_PER_STUDENT`, `MAX_COMPLIMENTS_PER_STUDENT`는 새 방의 기본값입니다. 실제 수업 중 방마다 교사 화면에서 1~10개 범위로 저장할 수 있습니다.

## 3. Firebase 설정 방법

1. Firebase Console에서 새 프로젝트를 만듭니다.
2. Build > Realtime Database를 선택합니다.
3. 데이터베이스를 만들고 위치를 선택합니다.
4. Project settings > General > Your apps에서 Web 앱을 추가합니다.
5. SDK 설정값을 복사해서 `app.js` 상단의 `firebaseConfig`에 붙여 넣습니다.
6. Realtime Database 화면의 URL이 `databaseURL`에 들어갔는지 확인합니다.
7. Rules 탭에 `firebase-rules.json` 내용을 붙여 넣고 게시를 누릅니다.

주의: 이 MVP의 교사 비밀번호는 정적 코드 안에 있으므로 완전한 보안 장치가 아닙니다. 실제 공개 서비스로 쓰려면 Firebase Authentication, 교사용 계정, 서버 검증 또는 Cloud Functions를 추가하세요.

## 4. Firebase 데이터 구조

```text
rooms
  roomCode
    mode: quiz | compliment | mafia | liar | catchmind | seat
    status: waiting | ready | playing | result | targetReveal | authorGuess | authorReveal
            roleAssigned | roleReveal | nightAction | nightResult
            discussion | voting | voteResult | roleRevealDead
            seatSelection | cardPhase | finalReady | finalReveal | finished
    maxQuestionsPerStudent
    maxComplimentsPerStudent
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

    liar
      settings
        wordA
        wordB
        liarCount
      majorityWord
      liarWord
      liarStudentIds
        0: studentId
      assignments
        studentId
          name
          word
      confirmations
        studentId
          name
          confirmedAt
      votes
        studentId
          voterName
          targetStudentId
          targetName
          votedAt
      startedAt
      voteOpenedAt
      voteResultOpenedAt
      revealedAt

    catchmind
      settings
        wordsText
        wordList
        roundDuration
        totalRounds
      gameId
      currentRoundIndex
      drawerOrder
      wordOrder
      currentRound
        roundId
        drawerId
        drawerName
        word
        roundStartedAt
        roundEndsAt
      rounds
        roundId
          strokes
          correctAnswers
          wrongAnswers
          scoreApplied

    seatGame
      settings
        rows
        columns
        disabledSeats
        cardEnabled
        cardPhaseSeconds
      gameId
      selectionOrder
      currentSelectionIndex
      assignments
        seat_1: studentId
      playerCards
        studentId
          type: swap | move | randomSwap | protect
          used
      protectedPlayerIds
      notifications
      cardActionHistory
      cardPhaseStartedAt
      cardPhaseEndsAt
      lastPublicEvent
      finalRevealStartedAt
      finalRevealOrder
```

## 5. 퀴즈 배틀 사용 방법

교사:

1. 교사로 입장합니다.
2. 게임 모드에서 퀴즈 배틀을 선택합니다.
3. 방 코드를 학생들에게 알려 줍니다.
4. 제출 문제 수와 학생 목록을 확인합니다.
5. 필요하면 제출 설정에서 학생 1명당 최대 문제 수를 바꾸고 설정 저장을 누릅니다.
6. 제출된 문제 목록에서 문제를 클릭하면 문제 전체와 선택지, 정답을 확인할 수 있습니다.
7. 교실 화면 팝업을 눌러 확장 모니터용 보기 전용 화면을 열 수 있습니다. 게임 시작 시에도 자동으로 열립니다.
8. 게임 시작을 누릅니다. 문제 순서는 자동으로 랜덤하게 섞입니다.
9. 문제마다 정답 공개, 다음 문제를 진행합니다.
10. 마지막에 최종 랭킹을 확인합니다.

학생:

1. 방 코드와 이름으로 입장합니다.
2. 자기 자신에 대한 4지선다 문제를 선생님이 정한 개수까지 만듭니다.
3. 게임이 시작되면 선택지를 눌러 답합니다.
4. 문제별 결과와 누적 점수를 확인합니다.

## 6. 칭찬 스무고개 사용 방법

교사:

1. 교사로 입장합니다.
2. 게임 모드에서 칭찬 스무고개를 선택합니다.
3. 방 코드를 학생들에게 알려 줍니다.
4. 학생들이 칭찬 카드를 제출할 때까지 기다립니다.
5. 필요하면 제출 설정에서 학생 1명당 최대 칭찬 카드 수를 바꾸고 설정 저장을 누릅니다.
6. 교실 화면 팝업을 눌러 확장 모니터용 보기 전용 화면을 열 수 있습니다. 게임 시작 시에도 자동으로 열립니다.
7. 제출된 칭찬 카드 목록을 확인하고, 부적절한 카드는 삭제합니다.
8. 게임 시작을 누릅니다. 칭찬 카드 순서는 자동으로 랜덤하게 섞입니다.
9. 첫 단서가 공개되면 학생들이 칭찬 대상을 추리합니다.
10. 다음 단서 공개를 눌러 단서를 하나씩 늘립니다.
11. 적절한 시점에 칭찬 대상 공개를 누릅니다.
12. 작성자 추리 시작을 누릅니다.
13. 작성자 공개를 누르면 카드 결과와 누적 랭킹을 확인할 수 있습니다.
14. 다음 칭찬으로 이동합니다.
15. 모든 카드가 끝나면 최종 랭킹을 봅니다.

학생:

1. 방 코드와 이름으로 입장합니다.
2. 칭찬할 친구를 선택합니다. 자기 자신은 선택할 수 없습니다.
3. 칭찬 카드는 서로 다른 친구 기준으로 선생님이 정한 개수까지 만들 수 있고, 각 카드마다 칭찬 단서를 4개 이상 입력합니다. 5번째 단서는 선택입니다.
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
5. 교실 화면 팝업을 눌러 확장 모니터용 보기 전용 화면을 열 수 있습니다. 역할 배정 또는 역할 확인 시작 시에도 자동으로 열립니다.
6. 역할 배정을 누릅니다.
7. 역할 확인 시작을 눌러 학생들이 자기 역할을 확인하게 합니다.
8. 밤 행동 시작을 누릅니다.
9. 모든 생존자가 패드에서 한 명을 선택하면 밤 결과 계산, 낮 결과 발표를 누릅니다.
10. 토론 시작을 눌러 낮 토론을 진행합니다.
11. 투표 시작, 투표 결과 공개, 정체 공개 순서로 진행합니다.
12. 승리 조건이 충족되지 않으면 다음 밤으로 넘어갑니다.
13. 사망자가 생기면 교사 화면의 유령 빙고 현황과 유령 채팅에서 사망자 활동을 확인할 수 있습니다.

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

## 8. 라이어게임 사용 방법

교사:

1. 교사로 입장합니다.
2. 게임 모드에서 라이어게임을 선택합니다.
3. 방 코드를 학생들에게 알려 주고 학생들이 입장할 때까지 기다립니다.
4. 제시어 1, 제시어 2, 라이어 수를 입력한 뒤 설정 저장을 누릅니다. 두 제시어는 서로 달라야 합니다.
5. 교실 화면 팝업을 눌러 확장 모니터용 보기 전용 화면을 열 수 있습니다. 게임 시작 시에도 자동으로 열립니다.
6. 게임 시작을 누릅니다. 앱이 다수 제시어와 라이어 제시어를 무작위로 정하고, 라이어 학생도 무작위로 배정합니다.
7. 학생들이 제시어를 확인했는지 현황을 봅니다. 이 단계에서는 교사 화면에도 실제 라이어 명단을 바로 보여 주지 않습니다.
8. 교실 대화가 끝나면 투표 시작을 누릅니다.
9. 모든 학생이 투표하면 투표 결과 공개를 누릅니다. 필요하면 투표 강제 종료를 눌러 바로 결과를 공개할 수 있습니다.
10. 투표 결과를 확인한 뒤 라이어 공개를 누르면 실제 다수 제시어, 라이어 제시어, 라이어 학생 명단이 공개됩니다.
11. 같은 제시어로 다시 하기를 누르면 같은 단어로 라이어만 새로 무작위 배정합니다. 설정 변경하기를 누르면 제시어 설정 화면으로 돌아갑니다.

학생:

1. 방 코드와 이름으로 입장합니다.
2. 게임이 시작되면 내 제시어 확인하기를 누르고 자기 단어만 조용히 확인합니다.
3. 앱은 본인이 라이어인지 아닌지 알려 주지 않습니다.
4. 교실에서 대화하며 서로의 제시어를 추리합니다.
5. 선생님이 투표를 시작하면 본인을 제외한 친구 중 라이어라고 생각하는 사람에게 한 번만 투표합니다.
6. 투표 결과가 공개되면 누가 의심받았는지 보고, 선생님이 라이어를 공개하면 실제 정답을 확인합니다.

보안 참고: 현재 MVP는 정적 웹앱이기 때문에 라이어 정답을 화면에서는 숨기지만, Firebase 방 데이터를 읽을 수 있는 사람에게 데이터베이스 수준으로 완전히 숨기는 구조는 아닙니다. 실제 비밀 유지가 중요한 운영에서는 Firebase Authentication과 Cloud Functions 같은 서버 검증을 추가해야 합니다.

## 9. 캐치마인드 사용 방법

교사:

1. 교사로 입장합니다.
2. 게임 모드에서 캐치마인드를 선택합니다.
3. 한 줄에 하나씩 제시어를 입력하고 제한 시간, 라운드 수를 정합니다.
4. 게임 시작을 누르면 출제자 순서와 제시어 순서가 무작위로 고정됩니다.
5. 출제자가 제시어를 확인하고 준비 완료를 누르면 라운드 시작을 누릅니다.
6. 진행 중에는 정답자, 미정답자, 최근 오답, 그림 화면을 확인합니다.
7. 시간이 끝나거나 라운드 강제 종료를 누르면 점수가 한 번만 확정되고 결과가 공개됩니다.
8. 다음 라운드 또는 최종 결과로 이동합니다.

학생:

1. 출제자로 뽑히면 제시어를 확인하고 그림으로만 표현합니다.
2. 다른 학생은 실시간 그림을 보며 정답을 입력합니다.
3. 30초 남으면 글자 수, 10초 남으면 초성 힌트가 자동으로 보입니다.
4. 정답 순서대로 1등 3점, 2등 2점, 3등 이후 1점을 받습니다.
5. 출제자는 정답자 비율에 따라 0~3점을 받습니다.

보안 참고: 현재 MVP는 정적 웹앱이라 화면에서는 출제자에게만 제시어를 보여 주지만, Firebase 방 데이터를 직접 읽는 수준까지 완전히 막는 구조는 아닙니다. 실제 비밀 유지가 중요하면 인증과 서버 검증을 추가하세요.

## 10. 자리바꾸기 게임 사용 방법

교사:

1. 자리바꾸기 게임을 선택하고 학생들이 방에 입장할 때까지 기다립니다.
2. 실제 교실에 맞게 행과 열을 정하고, 사용하지 않는 자리는 미리보기에서 눌러 X로 바꿉니다.
3. 카드 사용 여부와 카드 활용 시간을 정합니다.
4. 참가 학생 수와 사용 가능한 자리 수가 같은지 확인한 뒤 게임 시작을 누릅니다.
5. 교사 화면에서 전체 선택 순서와 학생별 카드 현황을 접어서 확인할 수 있습니다.
6. 학생 한 명이 자리를 확정하면 카드 활용 턴이 시작됩니다. 시간이 끝나면 자동으로 다음 선택으로 넘어가며, 필요하면 카드 활용 턴 종료를 누릅니다.
7. 마지막 학생 뒤의 카드 활용 턴까지 끝나면 최종 자리 공개를 누릅니다.
8. 같은 교실 구조로 다시 하기는 순서와 카드만 새로 섞고 자리 결과와 카드 사용 상태를 초기화합니다.

학생:

1. 게임이 시작되면 본인의 자리 선택 순서만 확인합니다.
2. 내 차례가 되면 선택 가능한 자리를 누르고 확인 창에서 확정합니다.
3. 다른 학생의 자리 주인은 보이지 않으며, 본인은 내 현재 자리 영역에서 자기 자리만 확인합니다.
4. 카드 활용 시간에는 원하는 경우에만 카드를 사용합니다. 사용하지 않은 카드는 다음 카드 활용 시간까지 유지됩니다.
5. 자리 교환, 다시 선택, 운명의 교환, 자리 보호 카드 중 받은 카드 한 장을 한 번 사용할 수 있습니다.
6. 카드 효과로 내 자리가 바뀌면 본인 화면에만 이전 자리와 현재 자리가 안내됩니다.
7. 마지막 공개가 시작되면 카운트다운 뒤 자리 번호 순서대로 학생 이름이 나타납니다.

동시 사용 처리: 자리 선택과 카드 효과는 방 전체 Firebase 트랜잭션으로 처리합니다. 거의 동시에 요청해도 최신 자리표를 다시 검증한 뒤 한 건씩 반영하며, 학생 중복 배정, 자리 중복 배정, 카드 재사용, 보호 자리 교환을 차단합니다.

보안 참고: 최종 공개 전 학생 화면과 교실 화면에는 자리 주인 이름을 렌더링하지 않습니다. 다만 현재 MVP는 인증 없이 방 전체 데이터를 구독하므로 개발자 도구 수준의 완전한 비밀 보장은 어렵습니다. 실제 보안이 필요하면 Firebase Authentication, 역할별 읽기 규칙, Cloud Functions를 추가해야 합니다.

## 11. 초기화 버튼 차이

- 게임 초기화: 점수와 답변, 진행 상태, 마피아 유령 목록, 유령 빙고, 유령 채팅을 지웁니다. 학생 목록과 제출 자료는 유지됩니다.
- 학생/자료 목록 초기화: 학생 목록, 문제 목록, 칭찬 카드, 마피아 진행 데이터, 라이어게임 진행 데이터, 캐치마인드 진행 데이터, 자리바꾸기 진행 데이터, 유령 데이터, 답변, 점수, 진행 상태를 모두 지웁니다.

## 12. 보안 주의사항

현재 MVP는 정적 웹앱이고 Realtime Database를 방 단위로 구독합니다. 그래서 생존자 화면에는 유령 채팅 UI를 렌더링하지 않지만, Firebase 규칙과 인증을 세밀하게 나누지 않는 한 개발자 도구 수준에서 데이터를 완전히 숨기는 구조는 아닙니다.

라이어게임도 같은 한계가 있습니다. 실제 라이어 명단과 제시어는 공개 전까지 화면에서 숨기지만, 인증 없이 방 전체를 읽는 현재 MVP 구조에서는 데이터베이스 수준의 완전한 비밀 정보가 아닙니다.

자리바꾸기 게임도 화면에서는 최종 공개 전 자리 주인을 숨기지만, 현재 공개형 방 규칙에서는 개발자 도구로 원본 배정 데이터를 조사하는 것까지 막을 수 없습니다.

실제 장기 운영용으로 강화하려면 Firebase Authentication으로 학생/교사 계정을 구분하고, 유령 채팅이나 라이어 정답 데이터를 별도 경로로 분리한 뒤 필요한 사용자만 읽을 수 있는 보안 규칙 또는 Cloud Functions 검증을 추가하세요.

## 13. 로컬 테스트 방법

미리보기 서버는 자동으로 실행하지 않았습니다. 파일을 받은 뒤 원하는 포트로 직접 정적 서버를 실행하세요.

```bash
python -m http.server 5500
```

브라우저에서 `http://localhost:5500`으로 접속합니다.

자리바꾸기 핵심 상태 전이 검사는 프로젝트 루트에서 다음 명령으로 실행할 수 있습니다.

```bash
node tests/seat-game-smoke.cjs
```

## 14. 배포 방법

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

## 15. 나중에 추가하면 좋은 기능

- 교사용 QR 코드 자동 생성
- Firebase Authentication 기반 교사 권한 분리
- App Check 적용
- 칭찬 카드 익명성 수준 설정
- 마피아 정체 비공개 모드
- 마피아 재투표 세부 규칙
- 라이어게임 단어 세트 저장
- 라이어게임 교사용 서버 비밀 저장
- 캐치마인드 제시어 카테고리 저장
- 캐치마인드 그림 데이터 자동 정리
- 자리바꾸기 카드 종류 및 카드 장수 설정
- 자리바꾸기 전용 인증 및 비공개 데이터 분리
- 유령 채팅 메시지 삭제 또는 채팅 잠금
- 교사용 마피아 진행 로그 다운로드
- 부적절한 단어 자동 경고
- 결과 CSV 다운로드
- 방 만료 시간 설정
- 학생 이름 중복 감지 강화
