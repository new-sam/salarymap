require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Dummy users for seeding
const DUMMY_USERS = [
  { email: 'seed_thanh_linh@dummy.local', name: 'Thanh Linh' },
  { email: 'seed_minh_duc@dummy.local', name: 'Minh Duc' },
  { email: 'seed_trang_nguyen@dummy.local', name: 'Trang Nguyen' },
  { email: 'seed_hoang_long@dummy.local', name: 'Hoang Long' },
  { email: 'seed_vy@dummy.local', name: 'Vy' },
  { email: 'seed_khanh_vy@dummy.local', name: 'Khanh Vy' },
  { email: 'seed_tuan@dummy.local', name: 'Tuan' },
  { email: 'seed_linh@dummy.local', name: 'Linh' },
  { email: 'seed_phuong_thao@dummy.local', name: 'Phuong Thao' },
  { email: 'seed_mai_anh@dummy.local', name: 'Mai Anh' },
  { email: 'seed_dat@dummy.local', name: 'Dat' },
  { email: 'seed_quynh@dummy.local', name: 'Quynh' },
  { email: 'seed_quoc_anh@dummy.local', name: 'Quoc Anh' },
  { email: 'seed_bao_tran@dummy.local', name: 'Bao Tran' },
  { email: 'seed_hung@dummy.local', name: 'Hung' },
  // Extra users for topic-based posts
  { email: 'seed_hai_nam@dummy.local', name: 'Hai Nam' },
  { email: 'seed_thu_ha@dummy.local', name: 'Thu Ha' },
  { email: 'seed_an_khang@dummy.local', name: 'An Khang' },
  { email: 'seed_ngoc_tram@dummy.local', name: 'Ngoc Tram' },
  { email: 'seed_duc_minh@dummy.local', name: 'Duc Minh' },
  { email: 'seed_hong_van@dummy.local', name: 'Hong Van' },
  { email: 'seed_cam_tu@dummy.local', name: 'Cam Tu' },
  { email: 'seed_thanh_dat@dummy.local', name: 'Thanh Dat' },
  { email: 'seed_my_linh@dummy.local', name: 'My Linh' },
  { email: 'seed_phuc@dummy.local', name: 'Phuc' },
]

async function createDummyUsers() {
  const userMap = {}
  for (const u of DUMMY_USERS) {
    // Check if user already exists
    const { data: existing } = await supabase.auth.admin.listUsers({ perPage: 1 })

    const { data, error } = await supabase.auth.admin.createUser({
      email: u.email,
      password: 'seed_dummy_pass_123!',
      email_confirm: true,
      user_metadata: { full_name: u.name }
    })
    if (error) {
      // User might already exist, try to find them
      const { data: users } = await supabase.auth.admin.listUsers({ perPage: 1000 })
      const found = users?.users?.find(x => x.email === u.email)
      if (found) {
        userMap[u.name] = found.id
        continue
      }
      console.error(`Failed to create user ${u.email}:`, error.message)
      continue
    }
    userMap[u.name] = data.user.id
  }
  return userMap
}

function daysAgo(days, hoursOffset = 0) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  d.setHours(d.getHours() - hoursOffset)
  return d.toISOString()
}

function anonName(name) {
  return name.charAt(0) + '**'
}

async function seed() {
  console.log('Creating dummy users...')
  const users = await createDummyUsers()
  console.log(`Created/found ${Object.keys(users).length} users`)

  const u = (name) => users[name]
  if (!u('Thanh Linh')) {
    console.error('Failed to create users. Check your SUPABASE_SERVICE_ROLE_KEY.')
    process.exit(1)
  }

  // ============================================================
  // POST 1: Performance review nhưng lương ko tăng
  // ============================================================
  const { data: post1 } = await supabase.from('community_posts').insert({
    user_id: u('Thanh Linh'),
    author_name: 'Thanh Linh',
    category: 'daily',
    title: 'Được sếp khen trong performance review nhưng lương ko tăng, title cũng ko đổi',
    content: `mình vừa trải qua một buổi performance review, sếp cùng có lời khen - nào là em đang đi đúng hướng, em làm việc tốt.. nma lương thì lại ko tăng nhiều, title cũng chả đổi.

mình tan làm về mà ko biết nên vui hay buồn. đc công nhận thì vui, nhưng mình cx 28t r, mấy lời khen cũng ko trả tiền nhà đc.

có ai từng ở trong tình huống mà mình được review ok nhưng lại ko thấy điều đó reflect ở lương tháng ko? Mng từng xử lý ntn? chờ đợt review sau, nói thẳng hay im lặng đi tìm chỗ làm mới?`,
    is_anonymous: false,
    like_count: 47,
    comment_count: 5,
    view_count: 312,
    created_at: daysAgo(3),
  }).select().single()

  if (!post1) { console.error('Failed to insert post1'); process.exit(1) }

  await supabase.from('community_comments').insert([
    {
      post_id: post1.id, user_id: u('Minh Duc'), author_name: 'Minh Duc',
      content: 'mình nghĩ b nên hẹn sếp 1 buổi 1-1 r hỏi thẳng lộ trình tăng lương với promotion cụ thể ntn. review tốt mà ko kèm con số gì thì nhiều khi là khen cho có thoi. hỏi để biết đường mà tính tiếp',
      is_anonymous: false, like_count: 12, created_at: daysAgo(3, -1)
    },
    {
      post_id: post1.id, user_id: u('An Khang'), author_name: anonName('An Khang'),
      content: '+1 mà nhớ ép timeline rõ ràng nha, kiểu "tầm bao lâu nữa em được xem xét", đừng để sếp trả lời chung chung "ráng thêm đi rồi tính" :))',
      is_anonymous: true, like_count: 8, created_at: daysAgo(3, -2)
    },
    {
      post_id: post1.id, user_id: u('Ngoc Tram'), author_name: anonName('Ngoc Tram'),
      content: 'thật ra lời khen là cách rẻ nhất để giữ người á b. cty nào cũng thích nhân viên vừa giỏi vừa ko đòi tăng lương. 28t r thì đi pvan thử vài chỗ xem thị trường trả mình bn, biết đâu mở mang',
      is_anonymous: true, like_count: 21, created_at: daysAgo(2, -3)
    },
    {
      post_id: post1.id, user_id: u('Trang Nguyen'), author_name: 'Trang Nguyen',
      content: 'mình từng y chang luôn. sếp khen quá trời mà tới đợt review tăng đúng 5%, lạm phát còn cao hơn =)) mình ráng chờ thêm 1 đợt nữa cũng v, cuối cùng nhảy việc +40%. công nhận là lời nói, lương là con số, 2 cái đó ko liên quan tới nhau đâu b',
      is_anonymous: false, like_count: 35, created_at: daysAgo(2, -5)
    },
    {
      post_id: post1.id, user_id: u('Duc Minh'), author_name: anonName('Duc Minh'),
      content: '"tan làm về mà ko biết nên vui hay buồn" đúng cảm giác mình mỗi kỳ review luôn',
      is_anonymous: true, like_count: 15, created_at: daysAgo(2, -7)
    },
  ])

  console.log('Post 1 done: Performance review')

  // ============================================================
  // POST 2: Deal lương khi phỏng vấn
  // ============================================================
  const { data: post2 } = await supabase.from('community_posts').insert({
    user_id: u('Hong Van'),
    author_name: anonName('Hong Van'),
    category: 'job_change',
    title: 'Kể 1 chuyện hơi đau để ai đang apply thì ko bị như mình',
    content: `Hồi năm ngoái mình có apply vô 1 cty, HR hỏi mức lương mình mong muốn là bnhieu, thì mình thật thà trả lời 12tr. lúc ngta offer đúng bằng con số mình đưa ra thì mình vui lắm.

Đi làm vài tháng sau quen được 1 bạn cũng vào cùng đợt, cùng level kinh nghiệm luôn. Bạn đó kể bạn offer mức cao hơn mình 3tr, cty cũng offer y chang.

Nên là mng có đi pvan deal lương gì thì nhớ tìm hiểu mức lương từ trước. HR họ hỏi cũng chỉ để biết để họ trả ít nhất có thể thoi.`,
    is_anonymous: true,
    like_count: 89,
    comment_count: 4,
    view_count: 567,
    created_at: daysAgo(5),
  }).select().single()

  await supabase.from('community_comments').insert([
    {
      post_id: post2.id, user_id: u('Hoang Long'), author_name: 'Hoang Long',
      content: 'chuẩn. lần sau lúc hr hỏi mong muốn thì đừng phun số ra vội, hỏi ngược lại budget của vị trí này tầm nhiêu, để họ ra số trước',
      is_anonymous: false, like_count: 28, created_at: daysAgo(5, -1)
    },
    {
      post_id: post2.id, user_id: u('Phuc'), author_name: anonName('Phuc'),
      content: 'cái vụ hỏi ngược budget hay á mà có hr nào chịu nói trước đâu b :)) toàn bắt mình nói. thì mình trả lời kiểu "em mong mức cạnh tranh theo thị trường, tùy jd cụ thể bên mình" rồi đẩy lại cho họ haha, ai lì hơn người đó thắng',
      is_anonymous: true, like_count: 14, created_at: daysAgo(5, -2)
    },
    {
      post_id: post2.id, user_id: u('Cam Tu'), author_name: anonName('Cam Tu'),
      content: 'thật ra cũng tùy, mình từng deal cao quá bị loại thẳng im luôn ko thèm rep lại. nên cũng phải biết tầm mình ở đâu, đừng hét trên trời quá',
      is_anonymous: true, like_count: 9, created_at: daysAgo(4, -3)
    },
    {
      post_id: post2.id, user_id: u('Vy'), author_name: 'Vy',
      content: 'nghe mà đau giùm b. 3tr x 12 là 36tr/năm r, chưa kể mấy lần tăng lương sau tính theo % nên nó kéo dài luôn. bài học đắt thật sự',
      is_anonymous: false, like_count: 41, created_at: daysAgo(4, -5)
    },
  ])

  console.log('Post 2 done: Deal luong')

  // ============================================================
  // POST 3: Manager mới micromanage
  // ============================================================
  const { data: post3 } = await supabase.from('community_posts').insert({
    user_id: u('My Linh'),
    author_name: anonName('My Linh'),
    category: 'daily',
    title: 'Manager mới micromanage quá, làm việc mệt hơn hẳn',
    content: `mình vừa có 1 chị manager mới sau khi qly cũ nghỉ, phải nói là như qua làm cty mới luôn v á. anh qly cũ thì giao việc xong là để mình tự làm, chỉ hỏi mình update khi cần th, nên mình làm việc cũng thoải mái mà output còn ok nữa.

chị manager mới thì sáng nào cũng hỏi tiến độ, cc hết mọi thứ vào mail, làm gì cũng review trước khi mình gửi cái gì đó. mới đầu mình cứ tưởng là do 2 chị em mới làm chung, chị chưa tin tưởng lắm, mà tận 2 tháng rồi chị vẫn vậy.

mình thấy cviec mình bị thay đổi 180 độ, mình bắt đầu làm chậm hơn, thiếu sáng tạo hơn, với giờ còn sinh ra thói hỏi xin phép trước khi làm gì đó, ngay cả cho những việc mà trc giờ mình có thể tự quyết định.

có bn nào từng làm việc với manager kiểu micromanage như v chưa? cho mình xin lời khuyên với, có cách nào để thích nghi hoặc thay đổi ko hay mình phải chờ hoặc xin chuyển qua team khác?`,
    is_anonymous: true,
    like_count: 63,
    comment_count: 4,
    view_count: 428,
    created_at: daysAgo(2),
  }).select().single()

  await supabase.from('community_comments').insert([
    {
      post_id: post3.id, user_id: u('Khanh Vy'), author_name: 'Khanh Vy',
      content: 'mình gặp y chang. cách mình làm là chủ động update trước khi chị kịp hỏi, đầu ngày nhắn "hôm nay em làm A B C nha chị", cuối ngày update lại. nghe hơi cực mà tầm 1 2 tháng chị tin r thì tự buông à. nhiều khi micromanage là do họ lo chứ ko hẳn là ko tin mình',
      is_anonymous: false, like_count: 24, created_at: daysAgo(2, -1)
    },
    {
      post_id: post3.id, user_id: u('Tuan'), author_name: 'Tuan',
      content: 'thử hết cách mà ko đỡ thì xin qua team khác hoặc đi đi b. mình ở với 1 ông micromanage 8 tháng, stress tới mất ngủ. ko đáng đâu',
      is_anonymous: false, like_count: 17, created_at: daysAgo(2, -3)
    },
    {
      post_id: post3.id, user_id: u('Thanh Dat'), author_name: anonName('Thanh Dat'),
      content: 'có khi nào chị ý mới lên cũng đang bị soi từ sếp của chị ko? nhiều khi áp lực dồn xuống nên mới vậy. thử ngồi nói chuyện thẳng 1 buổi xem chị cần gì ở mình, đôi khi chỉ là lệch cách làm việc thôi',
      is_anonymous: true, like_count: 19, created_at: daysAgo(1, -2)
    },
    {
      post_id: post3.id, user_id: u('Linh'), author_name: 'Linh',
      content: 'đọc đoạn "sinh ra thói hỏi xin phép trước khi làm gì đó" mà thấy thương ghê, micromanage nó bào mòn sự tự tin thật sự',
      is_anonymous: false, like_count: 31, created_at: daysAgo(1, -4)
    },
  ])

  console.log('Post 3 done: Micromanage')

  // ============================================================
  // POST 4: Từ chối offer cao vì toxic
  // ============================================================
  const { data: post4 } = await supabase.from('community_posts').insert({
    user_id: u('Phuong Thao'),
    author_name: 'Phuong Thao',
    category: 'job_change',
    title: 'Denied offer cao hơn 8tr vì cảm giác cty toxic, giờ vẫn ko biết đúng hay sai',
    content: `mình từng denied 1 offer cao hơn lương hiện tại 8tr, mà đến giờ mình vẫn ko chắc mình đã làm đúng ko nữa

cty offer mình có văn hoá có vẻ khá toxic, qua mấy vòng interview mình để ý họ hay móc mỉa nhau, còn khi mình hỏi về work-life balance thì lại trả lời chung chung, ko rõ ràng gì, với manager của cty còn tỏ vẻ ko happy khi mình hỏi về chuyện OT nữa

chỗ mình làm hiện tại thì cũng thoải mái, mng cũng thân thiện nma lương của mình lại tăng khá chậm, với mình thấy ko học thêm đc gì nhiều.

tính ra thì làm chỗ kia cho mình hơn gần 100tr/năm, cũng là số tiền lớn. liệu mình đang bảo vệ mental health bằng cách tránh mấy chỗ làm như cty kia hay chỉ đang sợ ko dám bước ra khỏi vùng an toàn của bản thân mình nhỉ?`,
    is_anonymous: false,
    like_count: 54,
    comment_count: 4,
    view_count: 389,
    created_at: daysAgo(4),
  }).select().single()

  await supabase.from('community_comments').insert([
    {
      post_id: post4.id, user_id: u('Hai Nam'), author_name: anonName('Hai Nam'),
      content: 'theo mình b làm đúng á. mấy cái đó là red flag rõ ràng r chứ ko phải b tưởng tượng đâu. tiền nhiều mà đi làm khóc mỗi ngày cũng ko đáng',
      is_anonymous: true, like_count: 18, created_at: daysAgo(4, -1)
    },
    {
      post_id: post4.id, user_id: u('Mai Anh'), author_name: 'Mai Anh',
      content: '+1, lương cao mà burnout nghỉ sau 6 tháng còn mệt hơn. b giữ được mình là ngon r',
      is_anonymous: false, like_count: 11, created_at: daysAgo(4, -2)
    },
    {
      post_id: post4.id, user_id: u('Dat'), author_name: 'Dat',
      content: 'thành thật thì 100tr/năm ko phải số nhỏ đâu b ơi. interview thấy toxic chưa chắc đã toxic, nhiều khi hôm đó họ căng. là mình thì mình sẽ liều vô 2 3 tháng, ko ổn thì đi. mà thôi quyết r thì đừng nghĩ lại nữa cho mệt đầu',
      is_anonymous: false, like_count: 7, created_at: daysAgo(3, -4)
    },
    {
      post_id: post4.id, user_id: u('Quynh'), author_name: 'Quynh',
      content: 'câu hỏi cuối của b hay á. mà mình nghĩ b có lý do cụ thể chứ ko phải sợ vu vơ, nên đây là bảo vệ mình chứ ko phải trốn vùng an toàn đâu',
      is_anonymous: false, like_count: 22, created_at: daysAgo(3, -6)
    },
  ])

  console.log('Post 4 done: Denied offer')

  // ============================================================
  // POST 5: Cô đơn ở cty (23 tuổi)
  // ============================================================
  const { data: post5 } = await supabase.from('community_posts').insert({
    user_id: u('Quoc Anh'),
    author_name: 'Quoc Anh',
    category: 'daily',
    title: '23t mới đi làm gần 1 năm, cảm thấy cô đơn trong cty',
    content: `em 23t, mới đi làm đc gần 1 năm th, em mình đang cảm thấy cô đơn trong cty lắm

ko phải em bị tẩy chay đâu ạ, mng trong cty nice lắm, nma do em là đứa nhỏ nhất trong team, chị nhỏ thứ 2 thì cũng 30 r. mng hay nói chuyện về con cái, nhà cửa,.. toàn mấy thứ em chưa nghĩ tới nữa ạ

em ko ghét cv, cũng ko ghét cty, anh chị trong team nice lắm í, cơ mà em ko tìm đc ai để thật sự nói chuyện hay chia sẻ, nhiều miếng em thả mà mng cũng hay ko hiểu, nhiều khi sợ anh chị thấy em còn trẻ con quá hay sao đó

có ai từng bị giống em ko ạ, cảm giác cứ ko phù hợp về mặt con người ấy ạ`,
    is_anonymous: false,
    like_count: 71,
    comment_count: 4,
    view_count: 445,
    created_at: daysAgo(1),
  }).select().single()

  await supabase.from('community_comments').insert([
    {
      post_id: post5.id, user_id: u('Thu Ha'), author_name: anonName('Thu Ha'),
      content: 'mình hiểu cảm giác này. hồi mới ra trường mình cũng nhỏ nhất, mng nói chuyện bỉm sữa với nhà cửa mình ngồi nghe ko biết góp gì :)) khuyên thật là đừng ép bản thân phải hợp với cả team, kiếm bạn cùng tuổi ở ngoài (nhóm sở thích, gym, bạn cũ) để cân bằng. còn ở cty thân thiện vừa đủ, làm tốt việc là đc r',
      is_anonymous: true, like_count: 19, created_at: daysAgo(1, -1)
    },
    {
      post_id: post5.id, user_id: u('Bao Tran'), author_name: 'Bao Tran',
      content: 'yên tâm đi em, ai mới đi làm cũng qua đoạn này hết á. ko cần hợp với cả team đâu, kiếm 1 2 người ok ok ăn trưa chung là đủ r. mà mấy anh chị lớn nhiều khi quý tụi nhỏ lắm đó, cứ hỏi han học hỏi, thả meme từ từ mng quen gu em à :))',
      is_anonymous: false, like_count: 14, created_at: daysAgo(1, -2)
    },
    {
      post_id: post5.id, user_id: u('An Khang'), author_name: anonName('An Khang'),
      content: 'đi làm ko nhất thiết phải có bạn thân ở cty đâu em. đồng nghiệp tốt, việc ổn, lương ổn là may lắm r. chuyện chia sẻ tâm sự để dành cho bạn ngoài đời. đừng buồn nha',
      is_anonymous: true, like_count: 23, created_at: daysAgo(1, -3)
    },
    {
      post_id: post5.id, user_id: u('Hung'), author_name: 'Hung',
      content: '23t mà suy nghĩ chững v là ngon r đó, anh 23t còn ham chơi muốn xỉu =))',
      is_anonymous: false, like_count: 27, created_at: daysAgo(0, -5)
    },
  ])

  console.log('Post 5 done: Co don o cty')

  // ============================================================
  // POST 6 (TOPIC): Counter-offer - nhảy việc bị giữ lại
  // ============================================================
  const { data: post6 } = await supabase.from('community_posts').insert({
    user_id: u('Hai Nam'),
    author_name: 'Hai Nam',
    category: 'job_change',
    title: 'Nộp đơn nghỉ xong cty counter-offer, giờ phân vân quá',
    content: `mình làm ở cty hiện tại 2 năm, lương tăng chậm nên quyết định đi pvan chỗ mới. offer mới +30% so với hiện tại.

mình nộp đơn nghỉ, ai ngờ sếp gọi vô phòng nói sẽ match lương chỗ mới, thêm cả promotion nữa. mình hơi shock vì 2 năm qua xin tăng lương toàn bị từ chối nhẹ nhàng.

1 phần mình muốn ở lại vì quen team, quen việc. nhưng 1 phần khác mình nghĩ nếu ko có offer bên ngoài thì cty có bao giờ tự tăng cho mình ko? cảm giác bị "giữ lại vì tiện" chứ ko phải vì trân trọng.

mng có kinh nghiệm gì về counter-offer ko? nên nhận hay nên đi?`,
    is_anonymous: false,
    like_count: 76,
    comment_count: 5,
    view_count: 521,
    created_at: daysAgo(6),
  }).select().single()

  await supabase.from('community_comments').insert([
    {
      post_id: post6.id, user_id: u('Trang Nguyen'), author_name: 'Trang Nguyen',
      content: 'kinh nghiệm cá nhân: đừng nhận counter-offer. thống kê cho thấy phần lớn người nhận counter rồi cũng nghỉ trong vòng 6-12 tháng. cty counter vì tìm người thay b tốn kém hơn tăng lương, chứ ko phải vì yêu quý b đâu',
      is_anonymous: false, like_count: 34, created_at: daysAgo(6, -1)
    },
    {
      post_id: post6.id, user_id: u('Duc Minh'), author_name: anonName('Duc Minh'),
      content: 'đúng r, mà nhận counter xong b sẽ bị gắn mác "người từng muốn đi" trong mắt sếp. đợt layoff sau b sẽ nằm trong danh sách đầu tiên',
      is_anonymous: true, like_count: 21, created_at: daysAgo(6, -2)
    },
    {
      post_id: post6.id, user_id: u('Cam Tu'), author_name: anonName('Cam Tu'),
      content: 'nói thật thì cũng tùy. mình từng nhận counter r ở lại thêm 1.5 năm rất vui. quan trọng là lý do b muốn đi là gì - nếu chỉ vì lương thì counter giải quyết được, nếu vì văn hoá hay sếp thì tiền ko fix được',
      is_anonymous: true, like_count: 15, created_at: daysAgo(5, -3)
    },
    {
      post_id: post6.id, user_id: u('Khanh Vy'), author_name: 'Khanh Vy',
      content: '"2 năm xin tăng toàn bị từ chối nhẹ nhàng" - câu này nói lên tất cả r b ơi. cty chỉ sẵn sàng trả đúng giá khi b sắp đi. đó ko phải cách đối xử với người họ trân trọng',
      is_anonymous: false, like_count: 42, created_at: daysAgo(5, -5)
    },
    {
      post_id: post6.id, user_id: u('Hai Nam'), author_name: 'Hai Nam',
      content: 'update: mình quyết định đi r mng ơi. cảm ơn mng, đọc hết comments mà thấy rõ hơn. đúng là nếu phải dọa nghỉ mới được tăng lương thì ở lại cũng ko yên tâm',
      is_anonymous: false, like_count: 55, created_at: daysAgo(4, -1)
    },
  ])

  console.log('Post 6 done: Counter-offer')

  // ============================================================
  // POST 7 (TOPIC): Sếp cướp credit
  // ============================================================
  const { data: post7 } = await supabase.from('community_posts').insert({
    user_id: u('Thu Ha'),
    author_name: anonName('Thu Ha'),
    category: 'daily',
    title: 'Sếp lấy credit của mình trước mặt ban lãnh đạo, ko biết phải làm sao',
    content: `tuần trước mình hoàn thành 1 project khá lớn, gần như mình solo từ đầu tới cuối. lúc present trước ban lãnh đạo thì sếp đứng lên trình bày hết, dùng toàn "chúng tôi đã nghiên cứu", "team chúng tôi triển khai"... trong khi thực tế chỉ có mình làm.

sau buổi họp có người khen sếp mình, sếp cười nhận luôn ko hề mention tên mình 1 lần. mình ngồi đó mà tức muốn khóc.

mình biết sếp cũng support mình ở mấy chỗ khác, nhưng cái feeling bị invisible trong chính công sức của mình nó đau lắm. mng có ai từng bị v ko? nên nói thẳng hay im lặng chờ cơ hội khác?`,
    is_anonymous: true,
    like_count: 82,
    comment_count: 4,
    view_count: 602,
    created_at: daysAgo(4, 3),
  }).select().single()

  await supabase.from('community_comments').insert([
    {
      post_id: post7.id, user_id: u('Dat'), author_name: 'Dat',
      content: 'lần sau nếu có project tương tự, b chủ động xin present luôn. kiểu "em muốn thử present trước leadership cho quen ạ". vừa lấy lại credit vừa ko gây conflict trực tiếp',
      is_anonymous: false, like_count: 29, created_at: daysAgo(4, 2)
    },
    {
      post_id: post7.id, user_id: u('Hoang Long'), author_name: 'Hoang Long',
      content: 'mình cũng bị 1 lần y chang. sau đó mình bắt đầu gửi mail update trực tiếp cho skip-level manager luôn, cc sếp vào. kiểu b tạo visibility cho bản thân mà sếp ko cản được. sếp mà hỏi thì nói "em muốn anh/chị trên cũng nắm tiến độ cho tiện ạ"',
      is_anonymous: false, like_count: 37, created_at: daysAgo(4, 1)
    },
    {
      post_id: post7.id, user_id: u('Ngoc Tram'), author_name: anonName('Ngoc Tram'),
      content: 'sad truth: ở nhiều cty thì sếp lấy credit là chuyện bình thường. sếp giỏi thì sẽ share credit, sếp tệ thì giữ hết. b ko thay đổi được sếp, chỉ thay đổi được cách b protect bản thân thôi',
      is_anonymous: true, like_count: 20, created_at: daysAgo(3, 5)
    },
    {
      post_id: post7.id, user_id: u('Mai Anh'), author_name: 'Mai Anh',
      content: '"tức muốn khóc" - ôm b. ai làm việc hết mình mà bị invisible thì đau lắm. nhưng cũng là bài học để b học cách "manage up" sớm. giỏi thôi chưa đủ, phải biết làm cho đúng người thấy nữa',
      is_anonymous: false, like_count: 25, created_at: daysAgo(3, 3)
    },
  ])

  console.log('Post 7 done: Credit stealing')

  // ============================================================
  // POST 8 (TOPIC): Quiet Quitting
  // ============================================================
  const { data: post8 } = await supabase.from('community_posts').insert({
    user_id: u('An Khang'),
    author_name: anonName('An Khang'),
    category: 'daily',
    title: 'Mình đang "quiet quitting" và ko thấy có gì sai cả',
    content: `từ đầu năm mình quyết định chỉ làm đúng scope công việc, ko nhận thêm, ko OT, ko check slack ngoài giờ. mng trong team gọi đó là quiet quitting.

trước đó mình là người hay xung phong, nhận thêm việc, ở lại muộn. đổi lại mình được gì? review bình thường, lương tăng bình thường, mà health thì đi xuống.

giờ mình về đúng giờ, cuối tuần ko mở laptop, thời gian dành cho gia đình và sức khoẻ. output vẫn đạt target. sếp có hơi khó chịu vì mình ko "beyond expectation" nữa, nhưng mình ko care.

mng nghĩ sao về quiet quitting? mình lười hay mình đang set boundary hợp lý?`,
    is_anonymous: true,
    like_count: 103,
    comment_count: 5,
    view_count: 734,
    created_at: daysAgo(2, 5),
  }).select().single()

  await supabase.from('community_comments').insert([
    {
      post_id: post8.id, user_id: u('Tuan'), author_name: 'Tuan',
      content: 'gọi là "quiet quitting" nghe tiêu cực, nhưng thực tế b chỉ đang làm đúng những gì b được trả lương để làm. đó ko phải lười, đó là professional boundary. vấn đề là cty quen khai thác lao động free nên khi ai đó ngừng thì bị gắn mác',
      is_anonymous: false, like_count: 45, created_at: daysAgo(2, 4)
    },
    {
      post_id: post8.id, user_id: u('Phuong Thao'), author_name: 'Phuong Thao',
      content: 'mình support b. trước mình cũng hay OT ko lương, cuối năm review vẫn y như mấy người về đúng giờ. từ đó mình hiểu: effort thêm mà ko ai ghi nhận thì chỉ là mình tự bóc lột mình thôi',
      is_anonymous: false, like_count: 38, created_at: daysAgo(2, 3)
    },
    {
      post_id: post8.id, user_id: u('Phuc'), author_name: anonName('Phuc'),
      content: 'cũng tùy giai đoạn nha. nếu b đang muốn lên senior hay chuyển role thì cần phải beyond expectation thật. nhưng nếu b đã ổn với vị trí hiện tại và ưu tiên cuộc sống thì hoàn toàn hợp lý. ko ai sai cả, chỉ là priority khác nhau',
      is_anonymous: true, like_count: 22, created_at: daysAgo(2, 2)
    },
    {
      post_id: post8.id, user_id: u('Linh'), author_name: 'Linh',
      content: '"đổi lại mình được gì? review bình thường, lương tăng bình thường" - ĐÚNG QUÁ. nhiều cty khen kiểu "em là pillar của team" mà lương vẫn tăng 5% như mọi người. vậy thì xung phong để làm gì',
      is_anonymous: false, like_count: 51, created_at: daysAgo(1, 8)
    },
    {
      post_id: post8.id, user_id: u('Thanh Dat'), author_name: anonName('Thanh Dat'),
      content: 'sếp khó chịu vì b ko beyond expectation nữa - vậy expectation thật sự là gì? nếu b đạt target thì b đã hoàn thành nghĩa vụ r. cái "beyond" đó nên đi kèm beyond compensation chứ',
      is_anonymous: true, like_count: 33, created_at: daysAgo(1, 6)
    },
  ])

  console.log('Post 8 done: Quiet quitting')

  // ============================================================
  // POST 9 (TOPIC): Quarter-life crisis
  // ============================================================
  const { data: post9 } = await supabase.from('community_posts').insert({
    user_id: u('Ngoc Tram'),
    author_name: 'Ngoc Tram',
    category: 'daily',
    title: '26 tuổi vẫn chưa biết mình muốn làm gì, có ai giống mình ko?',
    content: `mình 26t, đã qua 3 công ty, 2 ngành khác nhau. mỗi chỗ làm tầm 1 năm thì lại thấy "chắc ko phải cái này".

bạn bè mình người thì đã lên senior, người mua nhà, người đi du học. mình thì vẫn đang loay hoay ko biết mình giỏi cái gì, thích cái gì, phù hợp với cái gì.

ba mẹ hỏi "con làm tới đâu r" mình cũng ko biết trả lời sao. mỗi lần mở linkedin thấy mng flex achievement là mình lại tự ti.

mình biết so sánh là ko nên, nhưng khó lắm mng ơi. 26t mà cảm giác đang đứng giữa ngã tư ko biết rẽ đâu. có ai cũng đang/từng ở giai đoạn này ko?`,
    is_anonymous: false,
    like_count: 91,
    comment_count: 4,
    view_count: 678,
    created_at: daysAgo(3, 2),
  }).select().single()

  await supabase.from('community_comments').insert([
    {
      post_id: post9.id, user_id: u('Hung'), author_name: 'Hung',
      content: '29t đây, cũng từng như b lúc 26. giờ nhìn lại thì mấy năm "loay hoay" đó ko phí đâu, nó giúp mình hiểu mình ko muốn gì, từ đó mới biết mình muốn gì. cứ thử tiếp đi, đừng áp lực phải biết ngay lúc này',
      is_anonymous: false, like_count: 28, created_at: daysAgo(3, 1)
    },
    {
      post_id: post9.id, user_id: u('Vy'), author_name: 'Vy',
      content: 'tắt linkedin đi b =)) nói thật đó, linkedin là nơi mng chỉ post highlight thôi. ko ai post "tháng này mình bị sếp mắng" hay "mình vẫn chưa biết đường nào" đâu. so sánh với highlight reel của người khác sẽ luôn thua',
      is_anonymous: false, like_count: 37, created_at: daysAgo(3, 0)
    },
    {
      post_id: post9.id, user_id: u('Thanh Linh'), author_name: 'Thanh Linh',
      content: '28t cũng chưa biết đây :)) nhưng mình learn được 1 điều: ko cần biết đích cuối, chỉ cần biết bước tiếp theo là gì. hỏi mình "5 năm nữa muốn làm gì" thì chịu, nhưng "6 tháng tới muốn thử gì" thì dễ trả lời hơn',
      is_anonymous: false, like_count: 44, created_at: daysAgo(2, 8)
    },
    {
      post_id: post9.id, user_id: u('Cam Tu'), author_name: anonName('Cam Tu'),
      content: '"đứng giữa ngã tư ko biết rẽ đâu" - nhưng ít nhất b đang đứng chứ ko nằm ì 1 chỗ. 3 cty 2 ngành trong 3 năm = b đang tìm kiếm, đó là điều tốt chứ ko phải thất bại',
      is_anonymous: true, like_count: 31, created_at: daysAgo(2, 6)
    },
  ])

  console.log('Post 9 done: Quarter-life crisis')

  // ============================================================
  // POST 10 (TOPIC): Scope creep - làm nhiều hơn nhưng lương ko đổi
  // ============================================================
  const { data: post10 } = await supabase.from('community_posts').insert({
    user_id: u('Duc Minh'),
    author_name: anonName('Duc Minh'),
    category: 'ask_company',
    title: 'Bị giao thêm việc của 2 người nghỉ nhưng lương vẫn y nguyên',
    content: `team mình có 5 người, 2 người nghỉ liên tiếp trong 2 tháng, cty ko recruit thêm mà chia việc cho 3 người còn lại. giờ mình đang gánh scope của gần 2 người.

mình có raise vấn đề với sếp, sếp nói "tạm thời thôi, cty đang tìm người". tạm thời mà đã 4 tháng r ko thấy ai mới.

deadline thì vẫn giữ nguyên, expectation ko giảm, mà lương thì ko tăng 1 đồng. mình bắt đầu burn out thật sự. có nên nói thẳng "ko có thêm người thì em ko nhận thêm việc" ko hay sẽ bị đánh giá thái độ?`,
    is_anonymous: true,
    like_count: 68,
    comment_count: 4,
    view_count: 456,
    created_at: daysAgo(1, 3),
  }).select().single()

  await supabase.from('community_comments').insert([
    {
      post_id: post10.id, user_id: u('Minh Duc'), author_name: 'Minh Duc',
      content: '"tạm thời" trong ngôn ngữ corporate = vĩnh viễn nếu b ko push back. mình suggest b viết email liệt kê rõ workload hiện tại vs capacity, cc HR vào. đừng nói miệng vì miệng ko có bằng chứng',
      is_anonymous: false, like_count: 31, created_at: daysAgo(1, 2)
    },
    {
      post_id: post10.id, user_id: u('Bao Tran'), author_name: 'Bao Tran',
      content: 'nói thẳng luôn: cty ko recruit thêm là vì 3 người đang làm được việc của 5 người mà ko phàn nàn. cty tiết kiệm 2 suất lương. b đang bị exploit đấy, ko phải "teamwork"',
      is_anonymous: false, like_count: 44, created_at: daysAgo(1, 1)
    },
    {
      post_id: post10.id, user_id: u('Quynh'), author_name: 'Quynh',
      content: 'mình từng ở tình huống y chang. cuối cùng mình gửi mail nói rõ: "với workload hiện tại em chỉ có thể đảm bảo quality cho task A B C, task D E cần thêm resource hoặc dời deadline". professional mà firm, ko ai đánh giá thái độ được',
      is_anonymous: false, like_count: 26, created_at: daysAgo(0, 10)
    },
    {
      post_id: post10.id, user_id: u('Hong Van'), author_name: anonName('Hong Van'),
      content: '4 tháng "tạm thời" = cty đã quen với việc b gánh r. nếu ko set boundary sớm thì nó sẽ thành baseline mới, và review tới sếp sẽ kỳ vọng b làm khối lượng đó là bình thường',
      is_anonymous: true, like_count: 18, created_at: daysAgo(0, 8)
    },
  ])

  console.log('Post 10 done: Scope creep')

  // ============================================================
  // POST 11 (TOPIC): Impostor Syndrome
  // ============================================================
  const { data: post11 } = await supabase.from('community_posts').insert({
    user_id: u('Cam Tu'),
    author_name: 'Cam Tu',
    category: 'daily',
    title: 'Được promotion nhưng cảm giác mình ko xứng đáng',
    content: `tháng trước mình được promote lên senior, team chúc mừng hết, sếp cũng khen. nhưng mình lại ko vui nổi vì trong đầu cứ nghĩ "chắc do team thiếu người nên mới promote mình", "chắc tiêu chuẩn năm nay thấp".

mỗi lần họp với mấy anh chị senior khác mình đều thấy mình nhỏ bé, kiểu mình biết ít hơn, nói ít hơn, đóng góp ít hơn. mặc dù output của mình ko tệ, nhưng mình luôn feel like mình đang giả vờ biết cái mình đang làm.

có ai từng được promote hay đạt gì đó mà cảm giác ko deserve ko? làm sao để tin vào bản thân mình hơn?`,
    is_anonymous: false,
    like_count: 58,
    comment_count: 4,
    view_count: 398,
    created_at: daysAgo(5, 4),
  }).select().single()

  await supabase.from('community_comments').insert([
    {
      post_id: post11.id, user_id: u('Hoang Long'), author_name: 'Hoang Long',
      content: 'impostor syndrome là dấu hiệu b đang ở đúng chỗ - nghĩa là b đang ở vị trí challenge hơn khả năng b tự nhận thức. người thật sự ko xứng đáng thì ko bao giờ tự hỏi mình có xứng đáng ko đâu',
      is_anonymous: false, like_count: 33, created_at: daysAgo(5, 3)
    },
    {
      post_id: post11.id, user_id: u('My Linh'), author_name: anonName('My Linh'),
      content: 'mình cũng bị y chang khi lên lead. trick của mình là viết ra 1 list những gì mình đã làm được trong 6 tháng qua, cụ thể luôn. mỗi lần doubt thì lôi ra đọc. nhiều khi mình quên mất mình giỏi ở đâu vì chỉ focus vào cái mình chưa biết',
      is_anonymous: true, like_count: 27, created_at: daysAgo(5, 2)
    },
    {
      post_id: post11.id, user_id: u('Trang Nguyen'), author_name: 'Trang Nguyen',
      content: 'mấy anh chị senior khác cũng từng ngồi đúng chỗ b đó, cũng từng feel exactly like b. chỉ là họ đã quen hơn nên trông tự tin hơn thôi. give yourself time nha',
      is_anonymous: false, like_count: 19, created_at: daysAgo(4, 6)
    },
    {
      post_id: post11.id, user_id: u('Thanh Dat'), author_name: anonName('Thanh Dat'),
      content: '"chắc tiêu chuẩn năm nay thấp" - b nghĩ cty bỏ tiền tăng lương promote cho b chỉ vì tiêu chuẩn thấp á? =)) cty ko charitable v đâu, promote b là vì b có value. tin đi',
      is_anonymous: true, like_count: 41, created_at: daysAgo(4, 4)
    },
  ])

  console.log('Post 11 done: Impostor syndrome')

  // ============================================================
  // POST 12 (TOPIC): Fresh grad gửi CV ko ai rep
  // ============================================================
  const { data: post12 } = await supabase.from('community_posts').insert({
    user_id: u('Quoc Anh'),
    author_name: anonName('Quoc Anh'),
    category: 'job_change',
    title: 'Gửi hơn 50 CV mà chưa ai gọi phỏng vấn, bắt đầu nản',
    content: `em mới ra trường 2 tháng, gửi CV đi hơn 50 chỗ r mà mới chỉ có 2 chỗ gọi, cả 2 đều trượt ở vòng 2.

em biết là fresher thì khó xin việc, nhưng ko nghĩ khó đến v ạ. mỗi ngày check mail ko có gì, đa số là rejected hoặc im luôn ko thèm rep.

em bắt đầu tự hỏi có phải do CV em, do ngành em chọn, hay do em thiếu gì đó mà mình ko biết. ba mẹ hỏi "xin việc tới đâu r con" mà em ko dám trả lời thật.

có anh chị nào từng qua giai đoạn này cho em xin lời khuyên ạ. em nên tiếp tục spam CV hay dừng lại fix gì đó trước?`,
    is_anonymous: true,
    like_count: 85,
    comment_count: 5,
    view_count: 612,
    created_at: daysAgo(1, 8),
  }).select().single()

  await supabase.from('community_comments').insert([
    {
      post_id: post12.id, user_id: u('Dat'), author_name: 'Dat',
      content: 'dừng spam CV lại đi em. 50 CV mà chỉ 2 gọi = CV có vấn đề. nhờ ai đó review CV cho em, format rõ ràng, highlight project/intern nếu có. chất lượng hơn số lượng',
      is_anonymous: false, like_count: 22, created_at: daysAgo(1, 7)
    },
    {
      post_id: post12.id, user_id: u('Khanh Vy'), author_name: 'Khanh Vy',
      content: 'mình cũng từng gửi 70+ CV lúc ra trường. cái giúp mình nhất là: (1) tailor CV theo từng JD, đừng gửi 1 bản cho tất cả (2) viết cover letter ngắn gọn nói vì sao mình phù hợp (3) apply qua LinkedIn nếu được vì HR hay check đó hơn email',
      is_anonymous: false, like_count: 35, created_at: daysAgo(1, 6)
    },
    {
      post_id: post12.id, user_id: u('Phuc'), author_name: anonName('Phuc'),
      content: '2 tháng thôi em ơi, bình thường lắm. có người 4-5 tháng mới có việc. đừng nản, nhưng cũng đừng ngồi chờ - trong lúc apply thì học thêm skill gì đó để CV dày hơn, làm side project, lấy certificate. recruiter thấy em ko ngồi ko sẽ ấn tượng hơn',
      is_anonymous: true, like_count: 18, created_at: daysAgo(1, 5)
    },
    {
      post_id: post12.id, user_id: u('Thu Ha'), author_name: anonName('Thu Ha'),
      content: 'thêm nè: đừng chỉ apply online. đi networking, đi event, nhờ alumni giới thiệu. mình có việc đầu tiên là nhờ 1 anh khoá trên refer vô cty anh ấy, ko phải apply đâu',
      is_anonymous: true, like_count: 14, created_at: daysAgo(0, 12)
    },
    {
      post_id: post12.id, user_id: u('Bao Tran'), author_name: 'Bao Tran',
      content: '"ba mẹ hỏi mà ko dám trả lời thật" - cái này đau nhất. nhưng em ơi, giai đoạn này ai cũng qua hết. 5 năm nữa nhìn lại sẽ thấy nó nhỏ xíu. cứ kiên trì, sẽ có chỗ hợp với em thôi',
      is_anonymous: false, like_count: 29, created_at: daysAgo(0, 9)
    },
  ])

  console.log('Post 12 done: Fresh grad ghosting')

  // ============================================================
  // POST 13 (TOPIC): Sunday Scaries
  // ============================================================
  const { data: post13 } = await supabase.from('community_posts').insert({
    user_id: u('Phuc'),
    author_name: anonName('Phuc'),
    category: 'daily',
    title: 'Chiều chủ nhật nào cũng bắt đầu lo lắng về thứ 2',
    content: `ko biết có ai giống mình ko, cứ tầm 4-5h chiều chủ nhật là mình bắt đầu anxiety về thứ 2. nghĩ tới mấy cái deadline, mấy cái meeting, mấy cái email chưa reply.

đêm chủ nhật mình ngủ tệ nhất trong tuần, toss and turn cả đêm. sáng thứ 2 đi làm là đã mệt sẵn r.

mình ko ghét công việc, nhưng cái feeling "weekend sắp hết" nó ám ảnh lắm. mình đã thử tập thể dục, thử viết journal, nhưng nó vẫn quay lại mỗi tuần.

có ai cũng bị sunday scaries ko? mng xử lý bằng cách nào?`,
    is_anonymous: true,
    like_count: 74,
    comment_count: 4,
    view_count: 489,
    created_at: daysAgo(0, 8),
  }).select().single()

  await supabase.from('community_comments').insert([
    {
      post_id: post13.id, user_id: u('Mai Anh'), author_name: 'Mai Anh',
      content: 'mình cũng bị. cách mình deal: chiều thứ 6 trước khi rời office mình viết sẵn to-do list cho thứ 2. biết rõ thứ 2 sẽ làm gì thì bớt lo hơn, vì phần lớn anxiety đến từ sự mơ hồ "ko biết phải handle gì"',
      is_anonymous: false, like_count: 26, created_at: daysAgo(0, 7)
    },
    {
      post_id: post13.id, user_id: u('Tuan'), author_name: 'Tuan',
      content: 'nếu cứ lặp lại mỗi tuần thì nên xem lại: b đang lo vì workload quá nhiều hay vì môi trường toxic? nếu workload thì plan tốt hơn sẽ giúp. nếu toxic thì ko có trick nào fix được, chỉ có đi thôi',
      is_anonymous: false, like_count: 19, created_at: daysAgo(0, 6)
    },
    {
      post_id: post13.id, user_id: u('Ngoc Tram'), author_name: 'Ngoc Tram',
      content: 'mình từng bị nặng tới mức chiều thứ 7 đã bắt đầu lo r :)) sau đó mình đi therapy, therapist nói đó là 1 dạng anxiety nhẹ, và nó treatable. nếu b thấy nó ảnh hưởng quality of life thì đừng ngại tìm chuyên gia nha',
      is_anonymous: false, like_count: 22, created_at: daysAgo(0, 5)
    },
    {
      post_id: post13.id, user_id: u('Duc Minh'), author_name: anonName('Duc Minh'),
      content: 'trick nhỏ: chủ nhật mình plan 1 cái gì đó vui vào buổi tối - nấu ăn, xem phim, gặp bạn. thay vì để đầu trống nghĩ về thứ 2 thì fill nó bằng thứ mình enjoy. ko fix hoàn toàn nhưng đỡ hơn nhiều',
      is_anonymous: true, like_count: 17, created_at: daysAgo(0, 3)
    },
  ])

  console.log('Post 13 done: Sunday scaries')

  console.log('\n=== All 13 posts seeded successfully! ===')
}

seed().catch(err => {
  console.error('Seed failed:', err)
  process.exit(1)
})
