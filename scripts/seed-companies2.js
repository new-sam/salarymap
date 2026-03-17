const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://twpxsbnkypocjfnerfmd.supabase.co',
  'sb_publishable_SjIihxmBlpfQjTWVrTybMA_otiXIvWX'
);

const MORE_COMPANIES = [
  // 은행/보험 추가
  'VietCredit', 'Mirae Asset VN', 'Shinhan Finance VN', 'Lotte Finance VN',
  'HD Saison', 'FE Credit', 'SHB Finance', 'Mcredit',
  'Viet Capital Securities', 'SSI Securities IT', 'VPS Securities',
  'VNDIRECT IT', 'HSC Securities', 'MBS Securities',
  'Dragon Capital VN', 'VinaCapital IT', 'Manulife Invest VN',

  // 글로벌 IT 추가
  'Fujitsu Vietnam', 'NEC Vietnam', 'Hitachi Vantara VN',
  'DXC Technology VN', 'IBM Vietnam', 'Unisys Vietnam',
  'Ericsson Vietnam', 'Nokia Vietnam', 'Huawei Vietnam',
  'ZTE Vietnam', 'Vivo Vietnam IT', 'OPPO Vietnam IT',
  'Xiaomi Vietnam IT', 'TCL Vietnam IT',

  // 스타트업 / 핀테크 추가
  'Nano Technologies VN', 'Ant Group VN', 'PayME', 'Vietmoney',
  'Lendio VN', 'Fundiin', 'Moca (Grab Pay)', 'VinaPay',
  'Napas Digital', 'Paylink VN', 'ZPay', 'Ví FPT',
  'BuyMed', 'Medigo', 'Jio Health', 'BookingCare',

  // 에듀테크 추가
  'Amslink', 'Hocmai.vn', 'Moon.vn', 'Thinkzone VN',
  'GeniusEdu', 'BrainBox VN', 'SkillHub VN', 'FUNiX',
  'Vtalk', 'TalkFirst', 'Speaknow',

  // 물류/배송 추가
  'Ninja Van Vietnam', 'J&T Express VN', 'Kerry Express VN',
  'Best Express VN', 'Viettel Post IT', 'Vietnam Post IT',
  'Shipchung.vn', 'Boxme Global', 'eShip', 'Giao Hang Nhanh (GHN2)',

  // 미디어/광고테크
  'Admicro (VCCorp)', 'Adtima (Zalo)', 'iClick Vietnam',
  'Eclick', 'Digital Plus VN', 'Metta Digital', 'Ureka Media',
  'Brands Vietnam', 'Anymind Vietnam', 'Dentsu Vietnam IT',
  'Publicis Vietnam IT', 'Ogilvy Vietnam IT', 'WPP Vietnam IT',

  // 제조/산업 IT
  'Samsung Electronics VN IT', 'LG Electronics VN IT',
  'Intel Products VN', 'Jabil Circuit VN IT',
  'Foxconn VN IT', 'Pegatron VN IT',
  'Canon Vietnam IT', 'Nidec Vietnam IT',
  'Datalogic VN', 'Cognex Vietnam', 'Keyence VN',

  // SaaS/클라우드 로컬
  'VNG Cloud', 'Viettel Cloud', 'VNPT Cloud', 'CMC Cloud',
  'FPT Cloud', 'Bizfly Cloud', 'UpBase', 'Stringee',
  'Abit', 'Haraworks', 'Nhanh CRM', 'Callio',
  'Hana CRM', 'Chatbot.edu.vn', 'BotBanHang',

  // 기타 테크
  'Trusting AI', 'VinAI (Extended)', 'AIV Group',
  'Phenikaa-X', 'FutureLab VN', 'AI Academy VN',
  'SmartDev', 'KobiGo', 'Zien.vn', 'VR Plus VN',
];

// 중복 제거
const unique = [...new Set(MORE_COMPANIES)];

async function main() {
  console.log(`${unique.length}개 추가 중...`);

  const rows = unique.map(name => ({ name, tier: 3 }));
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

  const { count } = await supabase
    .from('companies')
    .select('*', { count: 'exact', head: true });

  console.log(`\n완료! 전체: ${count}개`);
}

main().catch(console.error);
