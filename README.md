# 우리 반 퀴즈 배틀

학생들이 직접 자기 자신에 대한 4지선다 문제를 만들고, 교사가 실시간으로 진행하는 카훗형 학급 퀴즈 MVP입니다.

## 1. 파일 구조

```text
class-quiz-battle/
├─ index.html
├─ style.css
├─ app.js
├─ firebase-rules.json
└─ README.md
```

## 2. Firebase 설정 방법

1. Firebase Console에서 새 프로젝트를 만듭니다.
2. Build > Realtime Database를 선택합니다.
3. 데이터베이스를 만들고 위치를 선택합니다.
4. 처음 테스트할 때는 잠시 테스트 모드로 시작해도 됩니다.
5. Project settings > General > Your apps에서 Web 앱을 추가합니다.
6. SDK 설정값을 복사해서 `app.js` 상단의 `firebaseConfig`에 붙여 넣습니다.
7. Realtime Database 화면의 URL이 `databaseURL`에 들어갔는지 확인합니다.
8. Rules 탭에 `firebase-rules.json` 내용을 참고해 규칙을 넣습니다.

`app.js` 상단에서 바꿀 수 있는 값:

```js
const TEACHER_PASSWORD = "1234";
const DEFAULT_TIME_LIMIT_SECONDS = 20;
const MAX_QUESTIONS_PER_STUDENT = 3;
const ALLOW_SOLVE_OWN_QUESTION = true;
const AUTO_REVEAL_WHEN_TIME_UP = true;
```

주의: 이 MVP의 교사 비밀번호는 정적 코드 안에 있으므로 완전한 보안 장치가 아닙니다. 실제 공개 서비스로 쓰려면 Firebase Authentication, 교사용 계정, 서버 검증 또는 Cloud Functions를 추가하세요.

## 3. Realtime Database 보안 규칙 예시

`firebase-rules.json`은 수업용 MVP 예시입니다. 클라이언트만으로 교사와 학생 권한을 완벽하게 구분할 수 없기 때문에, 공개 서비스용 규칙은 아닙니다.

더 안전하게 운영하려면 다음을 추가하는 것이 좋습니다.

- Firebase Authentication 익명 로그인
- 교사 계정 분리
- 답변 점수 계산을 Cloud Functions에서 처리
- 방 코드별 만료 시간
- 학생이 자신의 studentId 경로만 쓸 수 있는 규칙

## 4. 로컬 테스트 방법

미리보기 서버는 자동으로 실행하지 않았습니다. 파일을 받은 뒤 원하는 포트로 직접 정적 서버를 실행하세요.

```bash
python -m http.server 5500
```

그다음 브라우저에서 `http://localhost:5500`으로 접속합니다.

Node.js를 선호하면 다음처럼 실행해도 됩니다.

```bash
npx serve .
```

## 5. 배포 방법

### GitHub Pages

1. 이 폴더의 파일을 GitHub 저장소에 올립니다.
2. Settings > Pages로 이동합니다.
3. Deploy from a branch를 선택합니다.
4. `main` 브랜치와 `/root` 또는 `/docs` 폴더를 선택합니다.
5. 배포 주소를 학생들에게 공유합니다.

### Netlify

1. Netlify에서 Add new site > Deploy manually를 선택합니다.
2. `index.html`, `style.css`, `app.js`가 들어 있는 폴더를 끌어다 놓습니다.
3. 배포 주소를 학생들에게 공유합니다.

## 6. 교사용 사용 방법

1. 첫 화면에서 교사로 입장합니다.
2. 관리자 비밀번호를 입력합니다.
3. 방 코드를 비워 두면 자동 생성되고, 직접 입력해도 됩니다.
4. 전자칠판에 방 코드를 보여 줍니다.
5. 제출 문제 수와 학생 목록을 확인합니다.
6. 준비가 되면 게임 시작을 누릅니다. 게임 시작 시 문제 순서는 자동으로 랜덤하게 섞입니다.
7. 시간이 끝나면 자동으로 결과가 공개됩니다. 필요하면 정답 공개를 직접 누릅니다.
8. 결과를 확인한 뒤 다음 문제를 누릅니다.
9. 마지막 문제 뒤에는 최종 결과가 표시됩니다.
10. 같은 문제와 학생 목록을 유지한 채 다시 진행하려면 게임 초기화를 누릅니다.
11. 새 반이나 새 수업을 시작해서 학생 목록과 문제 목록까지 비우려면 학생/문제 목록 초기화를 누릅니다.

## 7. 학생용 사용 방법

1. 첫 화면에서 학생으로 입장합니다.
2. 선생님이 알려 준 방 코드와 이름을 입력합니다.
3. 자기 자신에 대한 가벼운 4지선다 문제를 최대 3개까지 만듭니다.
4. 문제, 선택지 4개, 정답 번호를 모두 입력하고 제출합니다.
5. 대기 화면에서 기다립니다.
6. 퀴즈가 시작되면 선택지를 눌러 답을 제출합니다.
7. 한 문제에는 한 번만 답할 수 있습니다.
8. 결과 화면에서 정답, 내 점수, 누적 점수를 확인합니다.

## 8. 나중에 추가하면 좋은 기능

- 교사용 QR 코드 자동 생성
- 방별 제한 시간 UI 설정
- 학생 이름 중복 감지
- 학생별 문제 제출 완료 체크 표시 확대
- 부적절한 단어 경고
- 게임 결과 CSV 다운로드
- Firebase Authentication 기반 권한 분리
- Cloud Functions 기반 점수 검증
- 교사용 화면과 학생용 화면 분리 URL
