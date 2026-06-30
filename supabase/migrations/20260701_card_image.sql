-- 디지털 명함 OG 미리보기 이미지(B 방식): 앱이 명함을 실제 폰트로 캡처한 PNG를 발행 시 업로드,
-- 공개 스토리지에 저장하고 그 URL을 og:image로 쓴다(서버 렌더 폰트 문제 없이 "명함 그림" 미리보기).
alter table business_cards add column if not exists card_image_url text;

-- 공개 읽기 버킷. service_role(API)이 업로드, 누구나 public URL로 조회.
insert into storage.buckets (id, name, public)
values ('card-images', 'card-images', true)
on conflict (id) do nothing;
