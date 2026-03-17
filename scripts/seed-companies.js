const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://twpxsbnkypocjfnerfmd.supabase.co',
  'sb_publishable_SjIihxmBlpfQjTWVrTybMA_otiXIvWX'
);

const NEW_COMPANIES = [
  // ── 은행 / 핀테크 ──
  'Standard Chartered VN', 'HSBC Vietnam', 'Citibank Vietnam', 'Shinhan Bank VN',
  'Woori Bank VN', 'KB Kookmin Bank VN', 'KEB Hana Bank VN', 'UOB Vietnam',
  'DBS Vietnam', 'Maybank Vietnam', 'CIMB Vietnam', 'Public Bank VN',
  'OCB Bank', 'SeABank', 'VietinBank Digital', 'Eximbank Digital',
  'PVcomBank', 'Nam A Bank', 'Bac A Bank', 'Kienlongbank',
  'ABBank Digital', 'BaoViet Bank', 'VietABank', 'BVBank',
  'Cake by VPBank', 'TNEX Digital', 'Timo', 'Finhay',
  'Infina', 'GIMO', 'Moneylover', 'Kredivo Vietnam',
  'Home Credit Vietnam', 'Vay Muon', 'WisePass', 'OnCredit',
  'Prudential Vietnam IT', 'Manulife Vietnam', 'AIA Vietnam', 'Sun Life Vietnam',
  'Generali Vietnam', 'AXA Vietnam', 'Bảo Việt IT', 'PVI Insurance IT',

  // ── 글로벌 빅테크 (VN 오피스) ──
  'Google Vietnam', 'Meta Vietnam', 'Microsoft Vietnam', 'Amazon AWS VN',
  'Oracle Vietnam', 'SAP Vietnam', 'Salesforce Vietnam', 'Adobe Vietnam',
  'ServiceNow Vietnam', 'Atlassian Vietnam', 'Autodesk Vietnam',
  'TikTok Vietnam', 'ByteDance Vietnam', 'Garena Vietnam', 'SEA Group VN',
  'Grab (Regional)', 'Rakuten Vietnam', 'LINE Vietnam', 'Mercari Vietnam',
  'Cybozu Vietnam', 'SoftBank Vietnam', 'KDDI Vietnam', 'Yahoo Japan VN',
  'CyberAgent Vietnam', 'DeNA Vietnam', 'Appier Vietnam', 'Recruit VN',
  'Transcosmos Vietnam', 'NTT Data Vietnam', 'Hitachi Solutions VN',
  'Cisco Vietnam', 'Juniper Networks VN', 'F5 Networks VN',
  'Palo Alto Networks VN', 'Fortinet Vietnam', 'Trend Micro VN',
  'CrowdStrike VN', 'Zscaler Vietnam',

  // ── IT 아웃소싱 / 컨설팅 ──
  'Global CyberSoft', 'Orient Software', 'Rikkeisoft', 'TMA Solutions',
  'Savvycom', 'Hachinet Software', 'Seta International', 'BrSE Vietnam',
  'Kyanon Digital', 'Arche Consulting', 'Nodeshift', 'TechElite Vietnam',
  'Nashtech Global', 'Mobidev Vietnam', 'Novus Soft VN', 'SotaERP',
  'BPO Infosoft', 'BPO NextG', 'SkyHub VN', 'Solazu',
  'Groove Technology', 'Techvify', 'CodeBase VN', 'DevPro Vietnam',
  'Innotech Vietnam', 'Axons VN', 'Hyperlogy', 'Smartosc',
  'Goldsun Digital', 'GEEK Up', 'Paradox Vietnam', 'DTS Vietnam',
  'AgileTech VN', 'Brocoders VN', 'Amaris Consulting VN', 'Codelink',
  'Fulcrum VN', 'CoderDojo VN', 'CodFishAI', 'Softgent',

  // ── 로컬 IT / SaaS ──
  'VCCorp', 'Nexttech Group', 'CMC Technology', 'CMC Telecom',
  'Misa Software', 'Fast Software', 'BravoSoft', 'SotaERP',
  'CloudGO', 'Getfly CRM', 'KiotViet (Parent)', 'Haravan',
  'Sapo', 'Nhanh.vn', 'Bán Hàng Pro', 'Pancake',
  'Novaon Digital', 'YouNet Group', 'Vinalink', 'MXH Hahalolo',
  'VTV Digital', 'HTV Digital', 'VnExpress Tech', 'Vietnamnet Digital',
  'Dantri.com', 'Kenh14 Tech', 'Cafef.vn', 'CafeF Tech',
  'Zing MP3', 'ZingTV', 'Zing News',

  // ── 통신 ──
  'VNPT-IT', 'VNPT VinaPhone', 'Viettel Digital', 'Viettel IDC',
  'Viettel Cyberspace', 'Mobifone IT', 'Vietnamobile', 'Gmobile',
  'MyTV (VNPT)', 'VTVcab Digital', 'FPT Telecom', 'FPT IS',
  'FPT Play', 'FPT AI', 'FPT Retail', 'FPT Automotive',

  // ── 이커머스 / 리테일 ──
  'Lazada Vietnam', 'Shopback Vietnam', 'Lotte Vietnam', 'AEON Vietnam IT',
  'Central Retail VN', 'WinCommerce', 'Masan Digital', 'VinID',
  'Guardian Vietnam', 'Pharmacity', 'Long Chau Digital', 'An Khang Digital',
  'HAPO Commerce', 'Vatgia.com', 'Websosanh', 'Hotdeal VN',
  'Dealtoday', 'Cungmua', 'Nhommua', 'Adayroi (legacy)',
  'Traveloka Vietnam', 'Agoda Vietnam', 'Booking.com VN', 'Klook Vietnam',
  'Mytour.vn', 'Vntrip', 'iVIVU', 'Gotadi',

  // ── 부동산 테크 ──
  'PropertyGuru VN', 'Batdongsan.com.vn', 'Homedy', 'Novaland IT',
  'Dat Xanh Digital', 'Sunshine Digital', 'Nam Long IT',
  'Phu My Hung IT', 'CBRE Vietnam Tech', 'JLL Vietnam Tech',
  'Savills Vietnam IT', 'Vinhomes IT',

  // ── 물류 / 모빌리티 ──
  'DHL Vietnam IT', 'FedEx Vietnam IT', 'Maersk Vietnam IT',
  'Gemadept Digital', 'Sotrans Digital', 'EcoTruck VN',
  'Vietnam Airlines IT', 'Vietjet IT', 'Bamboo Airways IT',
  'Be Group', 'FastGo', 'GoCar Vietnam', 'Xanh SM',
  'Công Nghệ Emddi',

  // ── 헬스케어 / 에듀테크 ──
  'Vinmec IT', 'Medlatec Digital', 'FV Hospital IT', 'CarePlus Digital',
  'eDoctor', 'DrAid Vietnam', 'Medpro Vietnam', 'emed Vietnam',
  'Topica', 'Edupia', 'DOL English App', 'Prep.vn',
  'Reboost Education', 'Everest Education Tech', 'IIG Vietnam',
  'Kyna.vn', 'Edumall', 'Unica.vn', 'CoderSchool', 'CoderDojo VN',
  'MindX', 'CodeLearn', 'SteamHouse', 'Clevai',

  // ── 게임 ──
  'VNG Games', 'Funtap', 'Hiker Games', 'VTC Game',
  'VTC Mobile', 'Appota', 'Sohagame', 'Topgame Vietnam',
  'eStar Vietnam', 'Gosu Vietnam', 'Mwork VN', 'Gamota',
  'NEXON Vietnam', 'Pearl Abyss VN', 'Garenanow VN',

  // ── 컨설팅 / 대기업 VN 오피스 ──
  'Deloitte Vietnam', 'PwC Vietnam', 'KPMG Vietnam', 'EY Vietnam',
  'McKinsey Vietnam', 'BCG Vietnam', 'Bain Vietnam',
  'Accenture Vietnam', 'Capgemini Vietnam', 'Cognizant Vietnam',
  'Wipro Vietnam', 'TCS Vietnam', 'Infosys Vietnam', 'HCL Vietnam',
  'Tech Mahindra VN', 'Mphasis Vietnam', 'Hexaware VN', 'Zensar VN',
  'Bosch Vietnam', 'Siemens Vietnam', 'Schneider Electric VN',
  'ABB Vietnam', 'Honeywell Vietnam', 'GE Digital VN',
  'Panasonic R&D VN', 'Samsung R&D VN', 'LG Vietnam IT', 'Intel Vietnam',
  'Qualcomm Vietnam', 'Renesas VN', 'Renesas Design VN',
  'Robert Bosch Engineering VN', 'Fukoku Vietnam IT',

  // ── 스타트업 / 기타 ──
  'Trusting Social', 'Tyme Vietnam', 'Viet Credit', 'iPay',
  'FastMobile', 'Toong', 'Paperless', 'Lark Vietnam',
  'Coda Vietnam', 'Notion VN (local team)', 'Figma VN (local team)',
  'Miro VN (local team)', 'Jira VN (local team)',
  'Slack VN (local team)', 'Zoom VN',
  'Skim.AI', 'Trusting AI VN', 'VinCSS', 'CyRadar',
  'Viettel Cyber Security', 'VSEC', 'SCS Vietnam',
  'AnNinh Mang', 'WhiteHat.vn',
].filter((v, i, a) => a.indexOf(v) === i); // 중복 제거

async function main() {
  console.log(`총 ${NEW_COMPANIES.length}개 회사 upsert 중...`);

  const rows = NEW_COMPANIES.map(name => ({ name, tier: 3 }));
  const BATCH = 50;
  let total = 0;

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { error } = await supabase
      .from('companies')
      .upsert(batch, { onConflict: 'name' });
    if (error) console.error('error:', error.message);
    else { total += batch.length; process.stdout.write('.'); }
  }

  // 현재 총 개수 확인
  const { count } = await supabase
    .from('companies')
    .select('*', { count: 'exact', head: true });

  console.log(`\n완료! 추가: ${total}개 / 전체: ${count}개`);
}

main().catch(console.error);
