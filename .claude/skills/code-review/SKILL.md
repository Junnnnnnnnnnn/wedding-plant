---
name: code-review
description: "작업한 변경사항에 대해 코드 리뷰만 수행하는 스킬. 서브 에이전트 없이 직접 리뷰한다. '코드 리뷰', 'review', '리뷰해줘', '변경사항 확인', '코드 검토' 등의 표현을 사용할 때 트리거한다. 브랜치에서 코드 리뷰가 필요한 모든 상황에서 이 스킬을 사용해야 한다."
---

# Code Review

브랜치에서 변경된 코드를 직접 리뷰한다. 서브 에이전트를 사용하지 않고 본인이 직접 수행한다.

## Step 1: 변경사항 수집

```bash
git diff --name-status HEAD
```

변경된 파일 목록을 확인한다.

## Step 2: 상세 diff 확인

```bash
git diff HEAD
```

전체 변경사항의 diff를 직접 확인한다. 필요하면 Read, Grep, Glob으로 주변 코드를 추가로 확인한다.

## Step 3: 코드 리뷰 수행

아래 체크 항목을 기준으로 리뷰한다. **코드를 절대 수정하지 않는다.**

### 체크 항목

- **Breaking Change**: API 응답/요청 필드명, 타입, URL 변경 여부, 프론트 영향
- **Breaking Change**: 기존 엔드포인트 `@deprecated` 처리 + v1 폴더 신규 추가 여부
- **보안**: SQL injection, XSS, 인증/인가 누락, 민감 정보 노출
- **타입 안전성**: `any` 사용, null/undefined 처리 누락
- **NestJS 패턴**: Controller에 비즈니스 로직 없는지, `ServiceError` 사용 여부
- **데코레이터**: class-validator, @nestjs/swagger (@ApiProperty에 description/example)
- **Swagger 데코레이터 누락**: DTO 프로퍼티에 @ApiProperty 또는 @ApiPropertyOptional이 빠져 있으면 직접 채워넣는다
- **코드 스타일**: 함수 50줄 제한, console.log 사용, 미사용 import

## Step 4: 리뷰 결과 보고

아래 형식으로 결과를 보고한다.

```
### 변경 파일 분류
| 파일 | 유형 | 변경 내용 |

### 지적사항
#### 🔴 심각 (반드시 수정)
#### 🟡 권고 (수정 권장)
#### 🟢 참고 (선택적)

### Breaking Change
(breaking change가 없으면 "없음"으로 표기)

### 요약
```

🔴 심각 지적이 있으면 사용자에게 명확히 전달하고 수정 여부를 확인한다.

## Step 5: Lint & Prettier

리뷰 완료 후 반드시 실행한다.

```bash
NODE_ENV=local npm run lint
NODE_ENV=local npm run format
```
