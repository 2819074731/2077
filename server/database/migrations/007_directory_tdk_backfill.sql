-- 补全目录站点缺失的关键词；星空数据按官网实际 TDK 回填。
UPDATE directory_entries
SET keywords = CONCAT_WS(',', name, category, '官网', '网址导航'), tdk_checked_at = NOW()
WHERE status = 'published' AND TRIM(COALESCE(keywords, '')) = '' AND id <> 124;

UPDATE directory_entries
SET title = '云启未来 - 星空数据',
    description = '星空数据专注高性能云服务器与物理机租用，提供香港CN、美国、日本、韩国、新加坡等多地区节点，支持BGP优化、高防线路、IPv6双栈、GPU算力等企业级方案。',
    keywords = '星空物语,星空数据,IDC,免费虚拟机,免费服务器,云服务器,物理机租用,香港CN服务器,美国服务器,高防服务器,海外服务器,BGP线路,GPU服务器,站群服务器',
    tdk_checked_at = NOW()
WHERE id = 124;
