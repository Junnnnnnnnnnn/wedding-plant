# 3D(Lanyard) 유지하면서 stash 적용하기

`git stash` 안에 DatePickerWheel·로그인 수정은 필요하고, Lanyard/setting 쪽 수정은 3D를 깨뜨리는 경우 사용하세요.

## 1. 지금 상태 커밋 (3D 동작하는 버전 고정)

```bash
git add components/Lanyard.tsx app/setting/page.tsx
git commit -m "chore: 3D 동작하는 Lanyard/setting 상태 유지"
```

## 2. stash 적용

```bash
git stash pop
```

DatePickerWheel, 로그인 관련 변경이 다시 적용됩니다.  
이때 `Lanyard.tsx`, `app/setting/page.tsx`가 stash 내용으로 덮어씌워지면 3D가 깨질 수 있습니다.

## 3. 3D가 깨졌을 때만 복구

3D(출입증 카드)가 안 보이거나 엑스박스가 뜨면, **Lanyard·setting 페이지만** 방금 커밋한 동작하는 버전으로 되돌리세요.

```bash
git checkout HEAD -- components/Lanyard.tsx app/setting/page.tsx
```

- DatePickerWheel, 로그인, 기타 파일 변경은 그대로 유지됩니다.
- `Lanyard.tsx`, `app/setting/page.tsx`만 3D가 동작하던 상태로 복구됩니다.

## 요약

| 목적              | 명령                                                               |
| ----------------- | ------------------------------------------------------------------ |
| 3D 동작 버전 고정 | `git add` + `git commit` (위 두 파일)                              |
| stash 적용        | `git stash pop`                                                    |
| 3D만 복구         | `git checkout HEAD -- components/Lanyard.tsx app/setting/page.tsx` |
