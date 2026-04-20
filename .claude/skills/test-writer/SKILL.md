---
name: test-writer
description: "변경된 코드에 대한 통합 테스트를 직접 작성/수정하고 실행하는 스킬. 서브 에이전트 없이 직접 수행한다. '테스트 작성', '테스트 만들어줘', 'write tests', '테스트 추가', '테스트' 등의 표현을 사용할 때 트리거한다. 브랜치에서 테스트 코드 작성이 필요한 모든 상황에서 이 스킬을 사용해야 한다."
---

# Test Writer

브랜치에서 변경된 코드에 대한 통합 테스트를 직접 작성/수정하고, 통과할 때까지 실행·수정을 반복한다. 서브 에이전트를 사용하지 않고 본인이 직접 수행한다.

## 토큰 절약 규칙

- 테스트 파일 읽을 때 import/describe 블록만 먼저 확인 (전체 X)
- Jest 실행 시 `--silent` + 실패 로그만 grep
- 테스트 파일 참고 시 필요한 파일만 최소한으로 (불필요한 파일 X)
- 재실행은 변경된 파일만 타겟

## 절대 금지

- **기존 소스 코드(테스트 파일이 아닌 파일)를 절대 수정하거나 덮어쓰지 않는다.**
- 테스트 파일(`test/` 디렉토리)만 생성·수정·삭제할 수 있다.
- 소스 코드에 문제가 있어도 직접 수정하지 말고 리포트에 기록만 한다.

## Step 1: 변경사항 확인

```bash
git diff --name-status HEAD
```

변경된 파일 목록을 확인한다. 필요하면 `git diff HEAD`로 상세 diff도 확인한다.

## Step 2: 기존 테스트 파일 확인

`test/` 디렉토리에서 관련 기존 테스트 파일을 확인하고 구조·import를 참고한다.

## Step 3: 테스트 작성/수정

기존 테스트가 있으면 수정, 없으면 새로 작성한다.

### 테스트 컨벤션

- **BDD 패턴**: `// Given`, `// When`, `// Then` 주석 필수
- **한글 설명**: `it()` 안의 테스트 설명은 한글
- **faker**: 테스트 데이터는 `@faker-js/faker` 사용
- **실제 DB**: mock 없이 PostgreSQL + Redis (docker-compose.test.yml)
- **supertest**: HTTP 요청은 `supertest` 사용
- **인증**: `authHeader(app)` 헬퍼 사용 (`test/setup/auth.helper`)
- **테이블 정리**: `afterEach`에서 `truncateTables(dataSource, [...])` 사용
- **앱 획득**: `getTestApp()` 싱글톤 사용 (`test/setup/test-app`)

## Step 4: 테스트 실행

```bash
npm run test:db:up
NODE_ENV=test npx jest --testMatch='**/test/**/*.spec.ts' --runInBand
```

실패 시 원인 분석 → 수정 → 재실행 (통과까지 반복한다).

## Step 5: 결과 보고

아래 형식으로 결과를 보고한다.

```
### 실행 결과
- 총 테스트 수 / 통과 수 / 실패 수

### 테스트 변경 내역
- 신규 작성 / 기존 수정 / 삭제 수

### 변경된 테스트 파일
| 파일 | 변경 유형 | 설명 |

### 주요 테스트 케이스
- [케이스 목록]
```

## Step 6: Lint & Prettier

테스트 통과 후 반드시 실행한다.

```bash
NODE_ENV=local npm run lint
NODE_ENV=local npm run format
npx prettier --write test/**/*.spec.ts
```

`npm run format`은 `test/` 디렉토리를 포함하지 않으므로 테스트 파일은 별도로 Prettier를 실행한다.
