# CLAUDE.md

## 주요 문서 위치 (어느 컴퓨터에서든 "열어줘" 하면 여기서 찾아 열 것)

브랜치 `feat/daily-summary-ceo-channel` 기준. 요청받으면 pull 후 기본 브라우저로 바로 열기 (경로만 알려주지 말 것).

| 호출어 | 파일 |
|---|---|
| 스태핑 링크드인 광고 설명서 | `docs/STAFFING_LINKEDIN_DM_GUIDE.html` (예시 이미지 `docs/shots/`) |
| 스태핑 FYI 조직도 | `docs/ORG_STRUCTURE.html` |
| FYI 스태핑 현황정리 | `docs/fyi-staffing/FYI_현황정리.md` |
| FYI 기업정책 | `docs/fyi-staffing/FYI_기업정책.md` |
| GTM 전략 | `docs/FYI_GTM_STRATEGY.html` |
| 스태핑 데일리 대시보드 | `docs/STAFFING_DAILY_DASHBOARD.html` |

링크드인 광고 확정값: 계정 SUPERCHIPS · 발신 KEE Kim · 대화 광고 · 리드 양식 개인정보처리방침 URL = https://ggmg.ai.kr/privacy (공고마감 서비스로 리드 수집).

---

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.
