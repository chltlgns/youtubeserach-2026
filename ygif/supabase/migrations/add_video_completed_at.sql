-- 제품 테이블에 영상 제작 완료 시간 컬럼 추가
-- 이 컬럼은 영상 제작 후 30일간 -60점 패널티를 적용하기 위해 사용됩니다.

ALTER TABLE products
ADD COLUMN IF NOT EXISTS video_completed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- 인덱스 추가 (선택적, 쿼리 성능 향상)
CREATE INDEX IF NOT EXISTS idx_products_video_completed_at
ON products (video_completed_at)
WHERE video_completed_at IS NOT NULL;

-- 코멘트 추가
COMMENT ON COLUMN products.video_completed_at IS '영상 제작 완료 시간. 30일간 -60점 패널티 적용';
