-- 제품 테이블에 브랜드 컬럼 추가
-- 브랜드 분류: Apple, 삼성전자, LG전자, HP, ASUS, 레노버, MSI, Dell, 한성컴퓨터, 베이직스, 기타

ALTER TABLE products
ADD COLUMN IF NOT EXISTS brand TEXT DEFAULT NULL;

-- 브랜드별 조회를 위한 인덱스
CREATE INDEX IF NOT EXISTS idx_products_brand
ON products (brand)
WHERE brand IS NOT NULL;

-- 브랜드별 + 영상 제작 시간 복합 인덱스 (같은 브랜드의 최근 영상 조회 최적화)
CREATE INDEX IF NOT EXISTS idx_products_brand_video
ON products (brand, video_completed_at)
WHERE brand IS NOT NULL AND video_completed_at IS NOT NULL;

COMMENT ON COLUMN products.brand IS '제품 브랜드 (Apple, 삼성전자, LG전자, HP, ASUS, 레노버, MSI, Dell, 한성컴퓨터, 베이직스, 기타)';
