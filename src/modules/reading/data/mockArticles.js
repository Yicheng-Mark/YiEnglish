/**
 * 英语阅读材料库 (2024-2026)
 *
 * 包含内容：
 * - 大学英语四级(CET-4)阅读理解 + 听力原文（2024-2025）
 * - 高考英语真题阅读（2024-2025）
 * - 大学英语六级(CET-6)阅读理解（2024-2025）
 * - 2026年英语时事短文（20篇）
 *
 * 数据说明：
 * - 文章数据硬编码在JS中，无需后端接口
 * - 听力使用浏览器TTS（语音合成）实时朗读，无需音频文件
 * - 每篇文章包含英文原文和中文翻译，逐段对照
 *
 * 使用方式：
 *   import { mockArticles } from './mockArticles';
 *
 * 数据来源：历年四六级/高考真题公开资料
 */

import gaokaoRaw from './mockArticles3.js'
import { mockArticles as cet6Raw } from './mockArticles4.js'
import { extraArticles } from './mockArticles5.js'
import { articles2026 } from './mockArticles6.js'

const rawMockArticles = [
  {
    id: 'cet4_reading_2024_06_01',
    title: 'The Art of Self-Control and Willpower',
    cnTitle: '自控与意志力的艺术',
    description: '阅读理解：People often wonder why some entrepreneurs are more successful than others. I believe the key to suc...',
    category: '教育',
    wordCount: 309,
    coverColor: 'bg-emerald-500',
    paragraphs: [
      { en: 'People often wonder why some entrepreneurs are more successful than others. I believe the key to success is willpower. Willpower is the ability to control yourself. It is a strong determination that allows you to do something difficult. It is a behavior we are born with more than one we learn; however, it is possible to not only learn it, but also strengthen it with constant exercise.', zh: '人们常常想知道为什么有些企业家比其他人更成功。我相信成功的关键是意志力。意志力是控制自己的能力。它是一种强烈的决心，让你能够做困难的事情。这种行为我们天生就有，而不仅仅是后天学来的；然而，它不仅可以通过学习获得，还可以通过不断的锻炼来增强。' },
      { en: 'Willpower is just like a muscle; to keep it strong you need to constantly exercise it. People with a great amount of willpower have the discipline to develop positive, successful habits. Even with an incredible amount of talent, without the discipline and motivation to create positive habits, it can be difficult to achieve success.', zh: '意志力就像肌肉一样；要保持强壮，你需要不断锻炼它。拥有大量意志力的人有纪律去培养积极、成功的习惯。即使有惊人的天赋，如果没有纪律和动力去创造积极的习惯，也很难取得成功。' },
      { en: 'According to research, almost half of our daily actions are performed out of habit, not decision. Once the right habits are established, a person will automatically carry out these tasks. A strong motivation is the key to developing and sticking to a habit. For example, a health concern or a passion for one\'s career can be a powerful motivation to change habits.', zh: '根据研究，几乎一半的日常行为都是出于习惯，而不是决策。一旦建立了正确的习惯，人就会自动执行这些任务。强烈的动机是养成和坚持习惯的关键。例如，健康问题或对事业的热情可以成为改变习惯的强大动力。' },
      { en: 'The art of self-control helps us succeed by enabling us to take positive actions and avoid behaviors that do not lead to success. Because there is a delayed satisfaction associated with self-control, it can be easy to get off track. However, if you work on sticking to those small positive habits one day at a time, it becomes easier to stay strong and achieve that delayed reward. Once a reward is achieved, it is much easier to continue sticking to your habits.', zh: '自我控制的艺术帮助我们成功，因为它使我们能够采取积极的行动，避免那些不会带来成功的行为。因为自我控制带来的满足感是延迟的，所以很容易偏离轨道。然而，如果你每天坚持那些小的积极习惯，就更容易保持坚强，实现延迟的回报。一旦获得了回报，就更容易继续坚持你的习惯。' }
    ]
  },
  {
    id: 'cet4_reading_2024_06_02',
    title: 'Scientific Research Funding',
    cnTitle: '科学研究资助',
    description: '阅读理解：Today, most scientific research is funded by government grants, companies doing research and develop...',
    category: '科技',
    wordCount: 373,
    coverColor: 'bg-rose-500',
    paragraphs: [
      { en: 'Today, most scientific research is funded by government grants, companies doing research and development, and non-profit foundations. As a society, we reap the rewards from this science, but we also help pay for it. You indirectly support science through taxes you pay, products and services you purchase, and donations you make.', zh: '如今，大多数科学研究由政府拨款、从事研发的公司以及非营利性基金会资助。作为一个社会群体，我们从这些科学研究中获益，但我们也为之付出。你通过缴纳的税款、购买的产品和服务以及捐赠，间接地支持了科学研究。' },
      { en: 'Funding for science has changed with the times. Historically, science has been largely supported through private patronage, church sponsorship, or simply paying for the research yourself. Today, researchers are likely to be funded by a mix of grants from various government agencies, institutions, and foundations. Other research is funded by private companies. Such corporate sponsorship is widespread in some fields. Almost 75% of U.S. clinical trials in medicine are paid for by private companies. And, of course, some researchers today still fund small-scale studies out of their own pockets. Most of us can\'t afford to do nuclear research as a private hobby, but birdwatchers, rock collectors, and others can do real research on a limited budget.', zh: '科学研究的资金来源随时代而变化。从历史上看，科学在很大程度上是通过私人资助、教会赞助，或者干脆自己掏钱进行研究来获得支持的。如今，研究人员很可能由来自不同政府机构、院校和基金会的拨款组合资助。其他研究则由私人公司资助。这种企业赞助在某些领域很普遍。在美国，几乎75%的医学临床试验是由私人公司出资的。当然，如今一些研究人员仍然自掏腰包资助小规模的研究。我们大多数人负担不起把核研究作为个人爱好，但观鸟者、岩石收集者和其他人可以在有限的预算内进行真正的研究。' },
      { en: 'In a perfect world, money wouldn\'t matter—all scientific studies would be completely objective. But in the real world, funding may introduce biases. Drug research sponsored by the pharmaceutical industry is more likely to end up favoring the drug under consideration than studies sponsored by government grants or charitable organizations. Similarly, nutrition research sponsored by the food industry is more likely to end up favoring the food under consideration than independently funded research.', zh: '在一个理想的世界里，资金并不重要——所有的科学研究都将是完全客观的。但在现实世界中，资金可能会引入偏见。由制药行业赞助的药物研究比由政府拨款或慈善组织赞助的研究更有可能最终支持所研究的药物。同样，由食品行业赞助的营养研究比独立资助的研究更有可能最终支持所研究的食品。' },
      { en: 'However, companies and special interest groups provide valuable resources for scientific research. Without such funding, much important research would never be done. The key is to recognize the potential for bias and to check the validity of industry-funded research with additional care.', zh: '然而，公司和特殊利益集团为科学研究提供了宝贵的资源。如果没有这样的资助，许多重要的研究将永远不会进行。关键是要认识到偏见的可能性，并额外仔细地审查行业资助研究的有效性。' }
    ]
  },
  {
    id: 'cet4_reading_2024_06_03',
    title: 'Aging and Learning',
    cnTitle: '老龄化与学习',
    description: '阅读理解：Some people have said aging is more a slide into forgetfulness than a journey towards wisdom. Howeve...',
    category: '教育',
    wordCount: 443,
    coverColor: 'bg-violet-500',
    paragraphs: [
      { en: 'Some people have said aging is more a slide into forgetfulness than a journey towards wisdom. However, a growing body of research suggests that late-in-life learning is possible. In reality, education does an aging brain good.', zh: '有些人说，衰老更多的是陷入健忘，而非走向智慧的旅程。然而，越来越多的研究表明，晚年学习是有可能的。事实上，教育对衰老的大脑有好处。' },
      { en: 'Throughout life, people\'s brains constantly renovate themselves. In the late 1960s, British brain scientist Geoffrey Raisman spied growth in damaged brain regions of rats through an electron microscope; their brains were forging new connections. This meant brains may change every time a person learns something new.', zh: '在人的一生中，大脑不断地自我更新。20世纪60年代后期，英国脑科学家杰弗里·雷斯曼通过电子显微镜观察到老鼠受损脑区的生长；它们的大脑正在建立新的连接。这意味着每当一个人学习新东西时，大脑可能就会发生变化。' },
      { en: 'Of course, that doesn\'t mean the brain isn\'t affected by the effects of time. Just as height usually declines over the years, so does brain volume: Humans lose about 4 percent every decade starting in their 40s. But that reduction doesn\'t necessarily make people think slower; as long as we are alive and functioning, we can alter our brains with new information and experiences.', zh: '当然，这并不意味着大脑不受时间的影响。就像身高通常会随着岁月流逝而降低一样，脑容量也是如此：从40岁开始，人类每十年大约会损失4%的脑容量。但这种减少并不一定使人思维变慢；只要我们活着且身体机能正常，我们就可以用新的信息和经历改变我们的大脑。' },
      { en: 'In fact, scientists now suspect accumulating novel experiences, facts, and skills can keep people\'s minds more flexible. New pathways can strengthen our ever-changing mental structure, even as the brain shrinks.', zh: '事实上，科学家们现在怀疑积累新的经历、事实和技能能让人们的思维更加灵活。即使大脑萎缩，新的路径也能强化我们不断变化的心理结构。' },
      { en: 'Conventional fixes like word puzzles and brain-training apps can contribute to mental durability. Even something as simple as taking a different route to the grocery store or going somewhere new on vacation can keep the brain healthy.', zh: '像字谜和大脑训练应用程序这样的常规方法有助于提高大脑的耐久性。甚至像走不同的路线去杂货店或去新的地方度假这样简单的事情也能保持大脑健康。' },
      { en: 'A desire for new life challenges can further boost brainpower. Research about aging adults who take on new enterprises shows improved function and memory as well as a reduced risk of mental disease. Openness—a characteristic defined by curiosity and a desire for knowledge—may also help folks pass brain tests. Some folks are born with this take-in-the-world attitude, but those who aren\'t as genetically gifted aren\'t necessarily out of luck. While genes can encourage an interest in doing new things, a 2012 study in the journal Psychology and Aging found completing reasoning tasks like puzzles and number games can enhance that desire for novel experiences, which can, in turn, refresh the brain. That\'s why brain scientist Richard Kennedy says \"It\'s not that old dogs can\'t learn new tricks. It\'s that maybe old dogs don\'t realize why they should.\"', zh: '对新生活挑战的渴望可以进一步提升脑力。关于从事新事业的老年人的研究表明，他们的功能和记忆力得到改善，同时患精神疾病的风险降低。开放性——一种由好奇心和对知识的渴望所定义的特质——也可能帮助人们通过大脑测试。一些人天生就有这种接纳世界的态度，但那些在基因上没有那么有天赋的人也不一定运气不好。虽然基因可以激发对做新事情的兴趣，但2012年发表在《心理学与衰老》杂志上的一项研究发现，完成像字谜和数字游戏这样的推理任务可以增强对新体验的渴望，这反过来又能使大脑焕然一新。这就是为什么脑科学家理查德·肯尼迪说：\"不是老狗学不了新把戏。而是老狗可能没意识到为什么它们应该学。\"' }
    ]
  },
  {
    id: 'cet4_reading_2024_06_04',
    title: 'Fashion and Law',
    cnTitle: '时尚与法律',
    description: '阅读理解：Richard Thompson Ford is a law professor, and you probably won\'t forget that for even one page. His ...',
    category: '文化',
    wordCount: 239,
    coverColor: 'bg-teal-500',
    paragraphs: [
      { en: 'Richard Thompson Ford is a law professor, and you probably won\'t forget that for even one page. His carefully reasoned arguments, packed with examples, sound almost like reading a court opinion, only maybe wordier. You will probably never think of fashion as a trifle again.', zh: '理查德·汤普森·福特是一位法学教授，你可能读这本书的任何一页都不会忘记这一点。他经过精心推理的论点，充满了例子，听起来几乎就像在读一份法庭意见书，只是可能更冗长。你可能再也不会把时尚当作微不足道的东西了。' },
      { en: 'Fashion is not merely about clothing and personal style. It reflects and shapes social norms, power dynamics, and cultural values. Ford argues that dress codes, whether formal or informal, serve as mechanisms of social control and identity expression. Throughout history, clothing has been used to signal status, profession, and belonging to particular groups.', zh: '时尚不仅仅关乎服装和个人风格。它反映并塑造社会规范、权力动态和文化价值观。福特认为，着装规范，无论是正式的还是非正式的，都是社会控制和身份表达的机制。纵观历史，服装一直被用来表示地位、职业和对特定群体的归属感。' },
      { en: 'The legal implications of fashion extend to workplace discrimination, religious expression, and gender identity. Courts have grappled with cases involving mandatory dress codes, the right to wear religious garments, and the boundaries of acceptable appearance in professional settings.', zh: '时尚的法律含义延伸到工作场所歧视、宗教表达和性别认同。法院一直在努力处理涉及强制性着装规范、穿戴宗教服装的权利以及职业环境中可接受外表界限的案件。' },
      { en: 'Ford\'s work challenges readers to reconsider the significance of what we wear and how society regulates personal appearance. Far from being superficial, fashion emerges as a complex arena where individual freedom intersects with collective expectations and institutional power.', zh: '福特的著作挑战读者重新考虑我们所穿之物的重要性以及社会如何规范个人外表。时尚远非肤浅，它成为一个复杂的竞技场，在这里个人自由与集体期望和制度权力相交。' }
    ]
  },
  {
    id: 'cet4_listening_2024_06_01',
    title: 'The Three Body Problem',
    cnTitle: '三体问题',
    description: '听力原文：W: Tom, did you see the article online about the new TV series based on the book The Three Body Prob...',
    category: '教育',
    wordCount: 291,
    coverColor: 'bg-blue-500',
    paragraphs: [
      { en: 'W: Tom, did you see the article online about the new TV series based on the book The Three Body Problem?', zh: '女：汤姆，你看到网上关于根据《三体》这本书改编的新电视剧的文章了吗？' },
      { en: 'M: A colleague mentioned the book, but I\'ve been so busy writing my thesis that I haven\'t been able to read for pleasure in months.', zh: '男：一位同事提到过这本书，但我一直忙于写论文，已经好几个月没能为 pleasure 而读书了。' },
      { en: 'W: Well, sounds like if you\'re going to read anything for fun, this is the book. It\'s written by a Chinese science fiction writer. I can\'t remember his name, but he\'s written three books in all, and The Three Body Problem is the first in the series. I don\'t want to say too much and spoil it for you, but it\'s definitely got some amazing technological and sociological concepts in it.', zh: '女：嗯，听起来如果你要读点什么来消遣的话，就是这本书了。它是由一位中国科幻作家写的。我记不住他的名字了，但他总共写了三本书，《三体》是系列中的第一部。我不想说太多而破坏你的兴致，但它确实有一些令人惊叹的技术和社会学概念。' },
      { en: 'M: It does sound like it would suit my taste, but if they are making a TV series based on it now, I don\'t know if I should read the book or watch the show first.', zh: '男：听起来确实适合我的口味，但如果他们现在要拍电视剧，我不知道应该先看书还是先看剧。' },
      { en: 'W: I think it\'s better to read the book first. It\'s rare for the show or movie to be better than the book. And then, you just end up ruining the book for yourself, if the show isn\'t very good.', zh: '女：我觉得最好先看书。电视剧或电影比书好的情况很少。如果剧不好看，你只会毁了这本书。' },
      { en: 'M: When is the show supposed to start? I\'m a bit overwhelmed with the amount of data I still need to collect to finish my thesis. But I still need to relax sometimes.', zh: '男：剧什么时候开始播？我被完成论文还需要收集的大量数据压得有点喘不过气来。但我有时还是需要放松。' },
      { en: 'W: I can\'t remember exactly. It\'s pretty soon, and it\'s going to be quite long. There are 24 episodes. Well, maybe you could download an electronic copy of the book and try to read it before the show starts.', zh: '女：我记不清确切时间了。很快就要播了，而且会有很长。有24集。嗯，也许你可以下载一本电子版的书，试着在剧开播之前读一下。' },
      { en: 'M: That\'s a good idea. And then, maybe we can watch the series together. Thanks for the tip, Alice.', zh: '男：好主意。然后，也许我们可以一起看这部剧。谢谢你的推荐，爱丽丝。' },
      { en: 'W: No problem.', zh: '女：不客气。' }
    ]
  },
  {
    id: 'cet4_listening_2024_06_02',
    title: 'Vegetarian Food Festival',
    cnTitle: '素食节',
    description: '听力原文：W: Hello, good afternoon. I have an inquiry to make. It\'s about the vegetarian food festival you are...',
    category: '社会',
    wordCount: 268,
    coverColor: 'bg-amber-500',
    paragraphs: [
      { en: 'W: Hello, good afternoon. I have an inquiry to make. It\'s about the vegetarian food festival you are holding on the 19th of August at the Newcastle City Hall.', zh: '女：你好，下午好。我想咨询一件事。是关于你们8月19日在纽卡斯尔市政厅举办的素食节。' },
      { en: 'M: Yes, of course. My name\'s Philip. How can I help you?', zh: '男：是的，当然。我叫菲利普。我能怎么帮您？' },
      { en: 'W: It says on your website that you are still looking for vendors, and I grow organic vegetables on my farm, as well as doing my own home baking. Would I be able to sell both the vegetables and items baked from them at the festival?', zh: '女：你们的网站上说你们还在寻找摊贩，我在农场种植有机蔬菜，还自己做家庭烘焙。我能在节日上既卖蔬菜又卖用蔬菜做的烘焙食品吗？' },
      { en: 'M: That\'s exactly the type of thing we are looking for. We\'re getting close to the deadline, however. Do you prefer to fill out an application on the web, or to print it out and fill it in by hand and then post it back to us? Remember that you will have to have all your certificates to hand when you are filling out the forms, as the standards are high and they will be carefully checked before anyone will be able to sell their produce at the event.', zh: '男：这正是我们要找的类型的东西。不过，截止日期快到了。你喜欢在网上填写申请表，还是打印出来手写然后寄回给我们？记住，在填写表格时，你必须准备好所有的证书，因为标准很高，在任何人能够在活动中销售他们的产品之前，这些证书都会被仔细检查。' },
      { en: 'W: I should be fine with doing it on your website, and I already have all my certificates, as we run a small farm shop too. But can you give me your details anyway?', zh: '女：我应该可以在你们的网站上完成，我已经有了所有的证书，因为我们也经营一家小农场商店。但不管怎样，你能给我你们的详细地址吗？' },
      { en: 'M: Sure. Please address it to the Organic Organization, Vendor Applications, 112 Queens Road, Newcastle, Northumbria. The postcode is NU 293LJ. Remember that the closing date is next Tuesday, the 28th of June.', zh: '男：当然。请寄给有机组织，摊贩申请，纽卡斯尔，诺森伯兰郡，皇后路112号。邮编是NU 293LJ。记住截止日期是下周二，6月28日。' },
      { en: 'W: That\'s absolutely wonderful. Thank you so much for your help. Goodbye.', zh: '女：太好了。非常感谢你的帮助。再见。' }
    ]
  },
  {
    id: 'cet4_listening_2024_06_03',
    title: 'Wild Camping in the UK',
    cnTitle: '英国野外露营',
    description: '听力原文：Supporters call it wild camping. Opponents call it illegal camping. What both sides accept is that t...',
    category: '环境',
    wordCount: 233,
    coverColor: 'bg-emerald-500',
    paragraphs: [
      { en: 'Supporters call it wild camping. Opponents call it illegal camping. What both sides accept is that there has been a boom in the past few months, with increasing numbers of visitors pitching their tents on any bit of land they fancy in the UK.', zh: '支持者称之为野外露营。反对者称之为非法露营。双方都承认的是，过去几个月这种现象出现了激增，越来越多的游客在英国任何他们喜欢的土地上搭帐篷。' },
      { en: 'In part, this reflects the fact that official campsites have been wholly or partially closed, or are overflowing, in a summer when fewer people are going abroad. With foreign holidays rendered difficult by travel restrictions, many UK residents are exploring their own country instead.', zh: '部分原因是由于这个夏天出国旅行的人减少，官方营地全部或部分关闭，或者已经满员。由于旅行限制使出国度假变得困难，许多英国居民改为探索自己的国家。' },
      { en: 'The debate over wild camping has become increasingly heated. Landowners complain about litter, environmental damage, and antisocial behavior. Campers argue that they are responsible, leave no trace, and simply want to enjoy the countryside.', zh: '关于野外露营的辩论变得越来越激烈。土地所有者抱怨垃圾、环境破坏和反社会行为。露营者辩称他们有责任感，不留下痕迹，只是想享受乡村风光。' },
      { en: 'Some areas have taken a more tolerant approach, designating specific zones where wild camping is permitted under certain conditions. Others have tightened enforcement, imposing fines on those who camp without permission.', zh: '一些地区采取了更宽容的态度，指定了特定区域，在某些条件下允许野外露营。其他地区则加强了执法，对未经许可露营的人处以罚款。' },
      { en: 'The issue highlights broader questions about access to the countryside, the right to roam, and how to balance individual freedom with environmental protection and property rights.', zh: '这个问题凸显了关于进入乡村的权利、漫游权以及如何在个人自由与环境保护和财产权之间取得平衡的更广泛问题。' }
    ]
  },
  {
    id: 'cet4_listening_2024_06_04',
    title: 'Teaching Children About Money',
    cnTitle: '教孩子理财',
    description: '听力原文：M: What\'s the best way to teach children how to save and spend their money?...',
    category: '教育',
    wordCount: 313,
    coverColor: 'bg-rose-500',
    paragraphs: [
      { en: 'M: What\'s the best way to teach children how to save and spend their money?', zh: '男：教孩子如何存钱和花钱的最好方法是什么？' },
      { en: 'W: You should make money a regular topic of discussion. It\'s best to start young, so it\'s instinctive rather than a scary subject.', zh: '女：你应该让钱成为经常讨论的话题。最好从小开始，这样就会很自然，而不是一个可怕的话题。' },
      { en: 'M: In our family, we talk openly about things like the budget for holidays, how taxes reduce your income, and how to shop around for the best deals.', zh: '男：在我们家，我们公开讨论假期预算、税收如何减少收入、以及如何货比三家找到最优惠的价格等事情。' },
      { en: 'W: Indeed. It\'s also essential to make money real for children through practical examples. Working out how much we save using discount pizza coupons, for example, is much more relevant than abstract sums.', zh: '女：确实。通过实际例子让钱对孩子来说变得真实也很重要。例如，算出使用折扣比萨券省了多少钱，比抽象的数字更有意义。' },
      { en: 'M: We also give our kids pocket money, and the amount they get is linked to chores, such as putting the bins out and emptying the dishwasher.', zh: '男：我们也给孩子零花钱，他们得到的金额与家务挂钩，比如倒垃圾和清空洗碗机。' },
      { en: 'W: We do that too, and it\'s paid according to their age. Two pounds for each year, so they can see some progression.', zh: '女：我们也这样做，而且按年龄支付。每年两英镑，这样他们可以看到一些进步。' },
      { en: 'M: Teaching them to save is important. We opened a savings account when they were young. After birthdays and Christmas, they would go to the branch and deposit their gift money.', zh: '男：教他们储蓄很重要。我们在孩子很小的时候就开了储蓄账户。生日和圣诞节后，他们会去分行存入他们的礼金。' },
      { en: 'W: Oh, I hadn\'t considered doing that. In our house, we have transparent money boxes for them to put small change in, so they can see their savings grow.', zh: '女：哦，我没考虑过那样做。在我们家，我们有透明的储蓄罐让他们放零钱，这样他们可以看到储蓄增长。' },
      { en: 'M: When the time is right, I\'ll start talking to our children about investing and show them how the money saved for their further education has grown.', zh: '男：时机成熟时，我会开始和孩子们谈论投资，并给他们看为深造而存的钱增长了多少。' },
      { en: 'W: I am always talking to my elder daughter about the importance of saving into a pension. She\'s just started a part-time job and was thinking of not contributing to her pension. Luckily, I managed to persuade her otherwise.', zh: '女：我一直在和我大女儿谈论存养老金的重要性。她刚开始做兼职工作，本来不想缴纳养老金。幸运的是，我说服了她改变主意。' },
      { en: 'M: Yes, it\'s such an important lesson to learn.', zh: '男：是的，这是很重要的一课。' }
    ]
  },
  {
    id: 'cet4_listening_2024_06_05',
    title: 'Rewarding Success (Book Review)',
    cnTitle: '奖励成功（书评）',
    description: '听力原文：W: Welcome to Books in Review. Our guest today is John Banks, the author of the bestselling new book...',
    category: '教育',
    wordCount: 395,
    coverColor: 'bg-violet-500',
    paragraphs: [
      { en: 'W: Welcome to Books in Review. Our guest today is John Banks, the author of the bestselling new book, Rewarding Success.', zh: '女：欢迎收看《书评》。今天的嘉宾是约翰·班克斯，畅销新书《奖励成功》的作者。' },
      { en: 'M: Glad to be here, Jane.', zh: '男：很高兴来到这里，简。' },
      { en: 'W: John, your book has certainly stirred up a lot of debate. Your main argument is that we should pay students for good grades and academic achievement. That sounds quite controversial.', zh: '女：约翰，你的书确实引发了很多争论。你的主要论点是我们应该为好成绩和学业成就付给学生报酬。这听起来很有争议。' },
      { en: 'M: Well, I know it sounds radical to some people, but the research is quite clear. When students are motivated by tangible rewards, they perform better. It\'s really that simple.', zh: '男：嗯，我知道对一些人来说这听起来很激进，但研究非常清楚。当学生受到有形奖励的激励时，他们表现更好。真的就是这么简单。' },
      { en: 'W: But critics argue that it undermines intrinsic motivation. Students should learn for the love of learning, not for money.', zh: '女：但批评者认为这会破坏内在动机。学生应该为热爱学习而学习，不是为了钱。' },
      { en: 'M: That\'s a nice ideal, but it doesn\'t work for everyone. Many students are disengaged from school. They don\'t see the value in education. Offering financial incentives gives them a reason to try.', zh: '男：这是一个美好的理想，但对每个人都有效。许多学生已经脱离了学校。他们看不到教育的价值。提供经济激励给了他们一个尝试的理由。' },
      { en: 'W: What about students who are already motivated? Wouldn\'t this be unfair to them?', zh: '女：那已经很有动力的学生呢？这对他们不公平吗？' },
      { en: 'M: Actually, my proposal includes rewards for improvement, not just for top grades. So a student who goes from a D to a B would get a significant reward. This levels the playing field.', zh: '男：事实上，我的提议包括奖励进步，不仅仅是最高分。所以一个从D升到B的学生会得到重大奖励。这创造了一个公平的竞争环境。' },
      { en: 'W: Where would the funding come from?', zh: '女：资金从哪里来？' },
      { en: 'M: I propose a combination of public and private funding. Some of it could come from reallocating existing education budgets. We spend so much on remedial programs that don\'t work. Let\'s invest in something that does.', zh: '男：我提议公共和私人资金的结合。一部分可以来自重新分配现有的教育预算。我们在那些无效的补习项目上花了太多钱。让我们投资于有效的东西。' },
      { en: 'W: You also talk about rewarding teachers, not just students.', zh: '女：你也谈到奖励教师，不仅仅是学生。' },
      { en: 'M: Absolutely. Great teachers are the key to student success. If we tie teacher bonuses to student improvement, we create a system where everyone is pulling in the same direction.', zh: '男：当然。优秀的教师是学生成功的关键。如果我们将教师奖金与学生的进步挂钩，我们就创造了一个每个人都朝着同一个方向努力的体系。' },
      { en: 'W: But won\'t this lead to teaching to the test?', zh: '女：但这不会导致应试教育吗？' },
      { en: 'M: That\'s a valid concern, which is why I emphasize measuring improvement rather than absolute scores. A teacher who takes struggling students and helps them make real progress should be rewarded, regardless of where those students end up in the rankings.', zh: '男：这是一个合理的担忧，这就是为什么我强调衡量进步而不是绝对分数。一个带着困难学生帮助他们取得真正进步的教师应该得到奖励，不管这些学生在排名中最终处于什么位置。' },
      { en: 'W: Interesting perspectives. Thank you for joining us, John.', zh: '女：有趣的观点。谢谢你加入我们，约翰。' },
      { en: 'M: Thank you for having me.', zh: '男：谢谢你邀请我。' }
    ]
  },
  {
    id: 'cet4_listening_2024_06_06',
    title: 'Saying \"I\'m Busy\"',
    cnTitle: '说"我很忙"',
    description: '听力原文：The speaker is launching a campaign to prevent people from complaining about being \"busy.\" Next time...',
    category: '社会',
    wordCount: 262,
    coverColor: 'bg-teal-500',
    paragraphs: [
      { en: 'The speaker is launching a campaign to prevent people from complaining about being \"busy.\" Next time someone asks us how we are, we should avoid saying we are busy.', zh: '演讲者正在发起一项运动，阻止人们抱怨自己\"忙碌\"。下次有人问你过得怎么样时，我们应该避免说自己很忙。' },
      { en: 'Many people make the \"I\'m busy\" response to cover up their failure to achieve some purpose. Being busy has become a status symbol in modern society. People wear their busyness as a badge of honor, as if being constantly occupied somehow makes them more important or more valuable.', zh: '许多人做出\"我很忙\"的回答是为了掩盖未能实现某些目标的失败。忙碌已成为现代社会的一种地位象征。人们把忙碌当作荣誉徽章来佩戴，好像不断忙碌不知怎的让他们更重要或更有价值。' },
      { en: 'The speaker argues that this culture of busyness is harmful. It prevents genuine connection. When you tell someone you\'re busy, you\'re essentially shutting down the conversation. You\'re saying you don\'t have time for them.', zh: '演讲者认为这种忙碌文化是有害的。它阻碍了真正的联系。当你告诉别人你很忙时，你实际上是在终止对话。你在说你没有时间陪伴他们。' },
      { en: 'Moreover, the constant state of busyness often masks a lack of priorities. People who are truly productive don\'t need to announce how busy they are. They simply get things done.', zh: '此外，持续的忙碌状态往往掩盖了优先事项的缺失。真正高效的人不需要宣布他们有多忙。他们只是把事情做完。' },
      { en: 'The campaign encourages people to be more mindful of their language and their time. Instead of automatically saying \"I\'m busy,\" the speaker suggests alternatives like \"I\'m focused on a project right now\" or \"I\'m taking some time for myself.\"', zh: '这项运动鼓励人们更加注意自己的语言和时间。演讲者建议用\"我现在正专注于一个项目\"或\"我正在给自己留一些时间\"等替代方式，而不是自动地说\"我很忙\"。' },
      { en: 'The goal is to create a culture where people are honest about their time and energy, where busyness is not glorified, and where meaningful work and meaningful relationships take precedence over the appearance of constant activity.', zh: '目标是创造一种文化，在这种文化中，人们对自己的时间和精力诚实，忙碌不被美化，有意义的工作和有意义的关系优先于不断活动的外表。' }
    ]
  },
  {
    id: 'cet4_listening_2024_06_07',
    title: 'Extreme Sports',
    cnTitle: '极限运动',
    description: '听力原文：It may sound strange to say that extreme sports can help one reduce fear. But research shows that fa...',
    category: '健康',
    wordCount: 252,
    coverColor: 'bg-blue-500',
    paragraphs: [
      { en: 'It may sound strange to say that extreme sports can help one reduce fear. But research shows that facing controlled fear in the context of extreme sports can actually decrease anxiety in everyday life.', zh: '说极限运动能帮助人们减少恐惧可能听起来很奇怪。但研究表明，在极限运动的背景下面对受控的恐惧实际上可以减少日常生活中的焦虑。' },
      { en: 'When doing extreme sports, one must be highly focused. This intense concentration is necessary to avoid dangerous mistakes. A single moment of distraction can have serious consequences.', zh: '做极限运动时，一个人必须高度专注。这种高度集中是必要的，以避免危险的错误。一瞬间的分心就可能产生严重后果。' },
      { en: 'This level of focus creates a state of flow, where the mind is completely absorbed in the present moment. Many extreme sports enthusiasts report that this mental state is one of the main attractions of their chosen activities.', zh: '这种专注程度创造了一种心流状态，在这种状态下，头脑完全沉浸在当下时刻。许多极限运动爱好者报告说，这种精神状态是他们选择的活动的主要吸引力之一。' },
      { en: 'Extreme sports can benefit us more than standard exercise routines and sports by enabling us to get an all-over workout. These activities engage not just the body but also the mind in ways that conventional exercise cannot match.', zh: '极限运动比标准锻炼和运动更能使我们受益，因为它能让我们得到全身锻炼。这些活动不仅锻炼身体，而且以传统锻炼无法比拟的方式锻炼大脑。' },
      { en: 'They require split-second decision making, physical coordination, and emotional regulation. The combination of physical exertion and mental challenge provides a comprehensive form of exercise.', zh: '它们需要瞬间决策、身体协调和情绪调节。体力消耗和脑力挑战的结合提供了一种全面的锻炼形式。' },
      { en: 'However, extreme sports are not without risks. Proper training, appropriate safety equipment, and awareness of one\'s limits are essential. The goal is not to be reckless but to push boundaries in a controlled and intelligent way.', zh: '然而，极限运动并非没有风险。适当的训练、适当的安全装备和对自身极限的认识是必不可少的。目标不是鲁莽，而是以受控和明智的方式突破界限。' }
    ]
  },
  {
    id: 'cet4_listening_2024_06_08',
    title: 'Conflict in Organizations',
    cnTitle: '组织中的冲突',
    description: '听力原文：Conflict in organizations is natural. Whenever people work together, differences of opinion are inev...',
    category: '社会',
    wordCount: 297,
    coverColor: 'bg-amber-500',
    paragraphs: [
      { en: 'Conflict in organizations is natural. Whenever people work together, differences of opinion are inevitable. The question is not whether conflict will occur, but how it will be managed.', zh: '组织中的冲突是自然的。只要人们一起工作，意见分歧就是不可避免的。问题不在于冲突是否会发生，而在于如何管理冲突。' },
      { en: 'Some people want to avoid conflict at all costs. They fear that disagreements will damage relationships or create an unpleasant work environment. These individuals often suppress their own opinions to maintain workplace harmony.', zh: '有些人想不惜一切代价避免冲突。他们担心分歧会破坏关系或创造一个不愉快的工作环境。这些人经常压抑自己的意见以维持工作场所的和谐。' },
      { en: 'However, productive conflict is important for teams and organizations. It stimulates innovative ideas. When people with different perspectives engage in open, respectful debate, they challenge each other\'s assumptions and push the group toward better solutions.', zh: '然而，建设性的冲突对团队和组织很重要。它能激发创新想法。当拥有不同观点的人参与开放、尊重的辩论时，他们挑战彼此的假设，推动团队找到更好的解决方案。' },
      { en: 'The key is to distinguish between productive and destructive conflict. Productive conflict focuses on ideas and issues, not personalities. It is characterized by open-mindedness, mutual respect, and a shared commitment to finding the best solution.', zh: '关键在于区分建设性冲突和破坏性冲突。建设性冲突关注想法和问题，而不是个性。它的特点是思想开放、相互尊重和共同致力于找到最佳解决方案。' },
      { en: 'Destructive conflict, on the other hand, is personal and attacks individuals. It creates divisions, damages trust, and undermines team cohesion.', zh: '另一方面，破坏性冲突是针对个人的，攻击个人。它制造分裂、破坏信任、削弱团队凝聚力。' },
      { en: 'Productive conflict needs mutual trust as a basis. Team members must believe that their colleagues have good intentions and that disagreements are about finding the best path forward, not about winning or losing.', zh: '建设性的冲突需要相互信任作为基础。团队成员必须相信他们的同事有良好的意图，分歧是关于找到最佳前进道路，而不是关于输赢。' },
      { en: 'Leaders play a crucial role in modeling and encouraging productive conflict. They must create psychological safety so that team members feel comfortable expressing dissenting views without fear of retribution.', zh: '领导者在示范和鼓励建设性冲突方面发挥着关键作用。他们必须创造心理安全感，让团队成员感到表达不同意见时不会因担心报复而不安。' }
    ]
  },
  {
    id: 'cet4_reading_2024_12_01',
    title: 'The Human Connection to Nature',
    cnTitle: '人类与自然的联系',
    description: '阅读理解：The weakening of the human connection to nature might be good for economic growth but is bad for peo...',
    category: '环境',
    wordCount: 408,
    coverColor: 'bg-emerald-500',
    paragraphs: [
      { en: 'The weakening of the human connection to nature might be good for economic growth but is bad for people. A tipping point was reached in 2020 when human-made materials—such as steel, concrete and plastic—were found to weigh more than all life on Earth. Continuing to grow concrete forests rather than real ones is shortsighted. Simply being in the nearest wood has such health benefits that the Woodland Trust successfully lobbied for it to be prescribed by doctors.', zh: '人类与自然联系的减弱可能有利于经济增长，但对人类有害。2020年达到了一个转折点，当时发现人造材料——如钢铁、混凝土和塑料——的重量超过了地球上所有生物的重量。继续发展混凝土森林而不是真正的森林是一种短视的行为。仅仅是到最近的树林里待一会儿就有如此大的健康益处，以至于林地信托成功地游说医生将其作为处方开出来。' },
      { en: 'Yet slipping from popular culture is the wonder and beauty of the natural world. For every three nature-related words in hit songs of the 1950s, researchers found, there was only slightly more than one 50 years later. It is not a moment too soon that teenagers will be able to take a natural history test, given that for decades children have been able to name more video game characters than wildlife species.', zh: '然而，自然世界的奇妙和美丽正在从流行文化中消失。研究人员发现，20世纪50年代热门歌曲中每三个与自然相关的词语，50年后就只剩下略多于一个了。鉴于几十年来孩子们能够说出更多的电子游戏角色名称而不是野生动物物种名称，青少年将能够参加自然历史测试，这并非为时过早。' },
      { en: 'Part of remedying this social disease would be for parliament to pass a \"right to grow\" law, allowing anyone to turn underused public spaces into vegetable and fruit gardens. The idea is for people to get back in touch with the soil—while producing food sustainably.', zh: '纠正这种社会疾病的部分方法是让议会通过一项\"种植权\"法律，允许任何人将未充分利用的公共空间变成蔬菜和水果园。这个想法是让人们重新接触土壤——同时可持续地生产食物。' },
      { en: 'Vegetable planting has a respectable tradition. In April 1649, locals responded to high prices and food shortages by cultivating vegetables on common land in Southern England. The practice of throwing seed bombs to turn vacant plots of land green took off in 1970s New York, and has been revived by green-thumbed social media influencers who defy local US regulations in a war on ugly spots in cities.', zh: '蔬菜种植有着值得尊敬的传统。1649年4月，当地人通过在英国南部的公共土地上种植蔬菜来应对高价格和食物短缺。投掷种子炸弹将闲置土地变绿的做法在20世纪70年代的纽约开始流行，并被有园艺天赋的社交媒体影响者复兴，他们无视美国当地法规，向城市中的丑陋斑点宣战。' },
      { en: 'Apart from the urgent task of providing more healthy nutrients to those who increasingly can\'t afford them, publicly accessible fruit and vegetable gardens connect what we eat to where it comes from—the means of production, if you will. They can make unlovely spaces lovely, and marry use and beauty as well as help promote a sense of community. Plants are also, of course, our first defence against species loss and climate change. Such planting is a small step for humanity—in the right direction.', zh: '除了向那些越来越负担不起的人提供更多健康营养的紧迫任务之外，公众可进入的水果和蔬菜园将我们吃的东西与它的来源联系起来——如果你愿意的话，这就是生产手段。它们可以使不美丽的空间变得美丽，将实用与美观结合起来，并帮助促进社区意识。当然，植物也是我们抵御物种灭绝和气候变化的第一道防线。这种种植对人类来说是一小步——但却是朝着正确方向的一小步。' }
    ]
  },
  {
    id: 'cet4_reading_2024_12_02',
    title: 'Chocolate and Global Warming',
    cnTitle: '巧克力与全球变暖',
    description: '阅读理解：Chocolates save us from many things, especially emotional distress. People believe chocolates can ch...',
    category: '科技',
    wordCount: 333,
    coverColor: 'bg-rose-500',
    paragraphs: [
      { en: 'Chocolates save us from many things, especially emotional distress. People believe chocolates can cheer them up instantly. For centuries, chocolate has been a beloved treat, valued for its rich flavor and mood-enhancing properties.', zh: '巧克力使我们从许多事情中解脱出来，尤其是情绪困扰。人们相信巧克力能立即让他们振作起来。几个世纪以来，巧克力一直是一种受人喜爱的美食，因其浓郁的风味和改善心情的特性而备受珍视。' },
      { en: 'However, scientists recently made a startling assertion: chocolate could become unavailable in less than 30 years. The reason is global warming. The cacao tree, from which chocolate is derived, grows only in a narrow band around the equator, requiring specific temperature and humidity conditions.', zh: '然而，科学家最近做出了一个惊人的断言：巧克力可能在不到30年的时间内变得无法获得。原因是全球变暖。可可树（巧克力来源于此）只在赤道周围的狭窄地带生长，需要特定的温度和湿度条件。' },
      { en: 'As temperatures rise, the suitable growing areas for cacao are shrinking. If cacao farms were shifted to cooler mountainous areas, the natural habitat of wildlife there would be ruined. This creates a difficult dilemma: protect the chocolate supply or protect mountain ecosystems.', zh: '随着气温上升，可可的适宜种植区域正在缩小。如果可可农场转移到较凉爽的山区，那里野生动物的自然栖息地将被破坏。这造成了一个两难困境：保护可可供应还是保护山地生态系统。' },
      { en: 'The cacao farms have suffered a lot due to a decrease in produce. Drought and rising temperatures have reduced yields in many traditional cacao-growing regions. Farmers are struggling to maintain production, and some are abandoning their farms altogether.', zh: '可可农场因产量下降而遭受了很多损失。干旱和气温上升减少了许�的多传统可可种植区的产量。农民们正在努力维持生产，一些人正在完全放弃他们的农场。' },
      { en: 'At the University of California\'s new bio-sciences building, scientists are trying to gene-edit cacao seedlings for them to withstand a drier, warmer climate. This cutting-edge research offers hope that we may be able to save chocolate from the threat of climate change.', zh: '在加州大学的新生物科学大楼里，科学家们正试图通过基因编辑可可幼苗，使它们能够承受更干燥、更温暖的气候。这项前沿研究给人们带来了希望，我们可能能够拯救巧克力免受气候变化的威胁。' },
      { en: 'The work involves identifying genes that help cacao trees resist heat and drought, then using CRISPR technology to incorporate these traits into commercial cacao varieties. If successful, this could ensure a stable chocolate supply for future generations while reducing the pressure to expand farming into sensitive mountain habitats.', zh: '这项工作涉及识别帮助可可树抵抗高温和干旱的基因，然后使用CRISPR技术将这些特性整合到商业可可品种中。如果成功，这可以确保为后代提供稳定的巧克力供应，同时减少将农业扩展到敏感山地的压力。' }
    ]
  },
  {
    id: 'cet4_reading_2024_12_03',
    title: 'Self-Driving Cars and Accidents',
    cnTitle: '自动驾驶汽车与事故',
    description: '阅读理解：Research in human-vehicle interaction has shown even systems designed to automate driving are far fr...',
    category: '科技',
    wordCount: 312,
    coverColor: 'bg-violet-500',
    paragraphs: [
      { en: 'Research in human-vehicle interaction has shown even systems designed to automate driving are far from being error-proof. Recent evidence points to drivers\' limited understanding of what these systems can and cannot do as a contributing factor to system misuse.', zh: '人车交互研究表明，即使是旨在实现自动驾驶的系统也远非万无一失。最新证据显示，驾驶者对系统功能的认知局限是导致误用的重要因素。' },
      { en: 'A recent study tackles the issue of over-trusting drivers and the resulting system misuse from a legal viewpoint. It looks at what the manufacturers of self-driving cars should legally do to ensure that drivers understand how to use the vehicles appropriately.', zh: '一项研究从法律视角探讨了驾驶者过度信任系统及由此引发的误用问题。它研究了自动驾驶汽车制造商在法律上应该做什么，以确保驾驶者了解如何正确使用车辆。' },
      { en: 'The study found that simply asking buyers to sign end-user license agreements (EULAs) is probably not sufficient to guarantee safety. Most people don\'t read these agreements carefully, and even if they do, the legal language may not effectively communicate the system\'s limitations.', zh: '研究发现，仅仅要求买家签署终端用户许可协议（EULA）可能不足以保证安全。大多数人不会仔细阅读这些协议，即使他们读了，法律语言也可能无法有效传达系统的局限性。' },
      { en: '\"Warning fatigue\" is another significant problem. When drivers receive too many warnings, they tend to ignore them over time. This phenomenon, combined with distracted driving, creates a dangerous situation where the driver is not prepared to take control when the system fails.', zh: '\"警告疲劳\"是另一个重要问题。当驾驶者收到太多警告时，他们往往会随着时间的推移而忽视它们。这种现象与分心驾驶相结合，造成了一种危险的情况，即当系统失效时，驾驶者没有准备好接管控制权。' },
      { en: 'The researchers argue that more emphasis should be placed on driver training. Simply handing someone the keys to a self-driving car without proper education about its capabilities and limitations is irresponsible.', zh: '研究人员认为，应该更加重视驾驶员培训。仅仅把自动驾驶汽车的钥匙交给某人，而不对其能力和局限性进行适当教育，是不负责任的。' },
      { en: 'Manufacturers need to develop better ways to communicate system limitations, perhaps through mandatory training programs or more intuitive in-vehicle displays. The goal should be to ensure that drivers have a realistic understanding of what the car can and cannot do.', zh: '制造商需要开发更好的方式来传达系统局限性，也许通过强制性培训计划或更直观的车内显示屏。目标应该是确保驾驶者对汽车能做什么和不能做什么有现实的理解。' }
    ]
  },
  {
    id: 'cet4_reading_2024_12_04',
    title: 'Protein Consumption',
    cnTitle: '蛋白质摄入',
    description: '阅读理解：Do you ever blend up a protein drink for breakfast, or grab a protein bar following an afternoon wor...',
    category: '健康',
    wordCount: 437,
    coverColor: 'bg-teal-500',
    paragraphs: [
      { en: 'Do you ever blend up a protein drink for breakfast, or grab a protein bar following an afternoon workout? If so, you are likely among the millions of people in search of more protein-rich diets.', zh: '你会在早餐时调制一杯蛋白质饮料，或者在下午锻炼后拿一根蛋白质棒吗？如果是这样，你可能是数百万寻求更多富含蛋白质饮食的人之一。' },
      { en: 'Protein-enriched products are found everywhere. But contrary to all the publicity that everyone needs more protein, most Americans get twice as much as they need.', zh: '蛋白质强化产品随处可见。但 contrary to 所有的宣传说每个人都需要更多蛋白质，大多数美国人摄入的蛋白质是他们需要的两倍。' },
      { en: 'Many of us living in the most developed countries are buying into a myth of protein deficiency created by food companies and self-identified health experts. Global retail sales of protein supplement products reached an astonishing US $18.9 billion in 2020.', zh: '我们这些生活在最发达国家中的许多人正在相信一种由食品公司和自称的健康专家创造的蛋白质缺乏神话。2020年，蛋白质补充剂产品的全球零售额达到了惊人的189亿美元。' },
      { en: 'But are we really in need of more protein? Physicians in the U.S. have never actually examined a patient with protein deficiency because simply by eating an adequate number of daily calories we are also most likely getting enough protein.', zh: '但我们真的需要更多蛋白质吗？美国医生从未实际检查过蛋白质缺乏的患者，因为仅仅通过摄入足够数量的每日卡路里，我们也很可能获得了足够的蛋白质。' },
      { en: 'In fact, Americans currently consume almost twice the National Academy of Medicine\'s recommended daily intake of protein although the most desirable protein intake may vary depending on age and activity level.', zh: '事实上，美国人目前摄入的蛋白质几乎是国家医学科学院推荐日摄入量的两倍，尽管最理想的蛋白质摄入量可能因年龄和活动水平而异。' },
      { en: 'For example, if you\'re a dedicated athlete you might need to consume higher quantities of protein. Generally, though, a 140-pound person should not exceed 120 grams of protein per day, particularly because a high protein diet can strain kidney and liver function and increase risks of developing heart disease and cancer.', zh: '例如，如果你是一名专注的运动员，你可能需要消耗更多的蛋白质。不过，一般来说，一个140磅的人每天不应该超过120克蛋白质，特别是因为高蛋白饮食会增加肾脏和肝脏功能的负担，并增加患心脏病和癌症的风险。' },
      { en: 'While fats and sugar have taken the beating in turns since over a century ago, protein has managed to remain our red-hot favorite.', zh: '自一个多世纪以来，脂肪和糖轮流受到打击，而蛋白质却一直保持着我们最热门的宠儿地位。' },
      { en: 'In the 1970s through the 1990s, protein products remained visible but moved back somewhat with the dietary spotlight firmly fixed on low-calorie, low-fat, sugar-free snack foods and beverages following the publication of studies linking sugar and saturated fat consumption to heart disease.', zh: '在20世纪70年代到90年代，蛋白质产品仍然可见，但 somewhat 退居次要地位，因为膳食聚光灯牢牢地固定在低热量、低脂肪、无糖零食和饮料上，此前发表的研究将糖和饱和脂肪的消耗与心脏病联系起来。' },
      { en: 'Later research in 2003, however, suggested high-protein diets could aid in weight loss, and protein quickly regained its former nutrient-superstar status.', zh: '然而，2003年的后续研究表明高蛋白饮食可以帮助减肥，蛋白质迅速重新获得了其以前的超级营养明星地位。' },
      { en: 'Now most people living in high-income nations are consuming enough protein. When we replace meals with a protein bar or drink, we also risk missing out on the rich sources of antioxidants, vitamins and many other benefits of real food.', zh: '现在，大多数生活在高收入国家的人摄入了足够的蛋白质。当我们用蛋白质棒或饮料代替正餐时，我们还可能错过抗氧化剂、维生素和许多真正食物的其他益处。' }
    ]
  },
  {
    id: 'cet4_listening_2024_12_01',
    title: 'Buying a New Phone',
    cnTitle: '买新手机',
    description: '听力原文：M: I\'m going to the city centre to buy a new phone today....',
    category: '社会',
    wordCount: 274,
    coverColor: 'bg-blue-500',
    paragraphs: [
      { en: 'M: I\'m going to the city centre to buy a new phone today.', zh: '男：我今天打算去市中心买一部新手机。' },
      { en: 'W: Didn\'t you buy a new phone just two months ago?', zh: '女：你不是两个月前才买了一部新手机吗？' },
      { en: 'M: It was three months ago, and I already know what you\'re going to say. You\'re thinking I shouldn\'t replace my phone this soon.', zh: '男：是三个月前，而且我已经知道你要说什么了。你觉得我不应该这么快就换手机。' },
      { en: 'W: No, actually, I was wondering how you could possibly afford a new phone. But, now that you mention it, I do think getting another phone so soon is wasteful, regardless of the cost.', zh: '女：不，其实，我是在想你怎么可能负担得起一部新手机呢。不过既然你提到了，我也觉得这么快又买一部手机，不管花多少钱，都是浪费。' },
      { en: 'M: Maybe you\'re right, but the thing is, everyone at the office has a nice, expensive phone, and I\'m a little embarrassed by mine. I just got a credit card, so I thought I might as well buy a new phone.', zh: '男：也许你说得对，但问题是，办公室里的每个人都有一部漂亮又昂贵的手机，而我的手机让我有点尴尬。我刚拿到信用卡，所以我想干脆买一部新手机吧。' },
      { en: 'W: I don\'t think buying a phone on credit is a good idea. Look, you\'ve only been working for five months now. People understand that you are a recent graduate, and I doubt anyone cares about your phone other than yourself.', zh: '女：我觉得用信用卡买手机可不是个好主意。你看，你到现在才工作了五个月。大家都知道你是刚毕业的学生，而且我怀疑除了你自己，没人会在意你的手机。' },
      { en: 'M: Maybe you\'re right, but the credit card has a very good special offer, where I don\'t pay any interest for six months. I\'ll be able to pay for the phone well before that period is over.', zh: '男：也许你说得对，但那张信用卡有个很不错的特惠活动，六个月内不用付利息。我肯定能在那段时间之前还清手机的费用。' },
      { en: 'W: I still think it\'s a bad idea to use a credit card for something you don\'t need. One of my colleagues bought a lot of things on credit during her first year of work, and it became a bad habit, and she accumulated a lot of debt.', zh: '女：我还是觉得用信用卡买不需要的东西是个坏主意。我有个同事在工作的第一年就用信用卡买了很多东西，结果养成了坏习惯，还欠了一大笔债。' },
      { en: 'M: Well, I can see how that might happen to someone, and I\'m sure she regrets it, but I know it won\'t happen to me.', zh: '男：嗯，我能理解这种事可能会发生在别人身上，而且我相信她现在肯定后悔了，但我知道这种事不会发生在我身上。' }
    ]
  },
  {
    id: 'cet4_listening_2024_12_02',
    title: 'Tiny Home Movement',
    cnTitle: '小房子运动',
    description: '听力原文：W: Welcome to The Morning Show. Our guest today is a popular blog writer and a major figure in the t...',
    category: '环境',
    wordCount: 316,
    coverColor: 'bg-amber-500',
    paragraphs: [
      { en: 'W: Welcome to The Morning Show. Our guest today is a popular blog writer and a major figure in the tiny home community. Welcome, Bob Jones.', zh: '女：欢迎收看《晨间秀》。今天我们的嘉宾是一位受欢迎的博客作家，也是微型住宅社区的重要人物。欢迎你，鲍勃·琼斯。' },
      { en: 'M: Hi, Mary.', zh: '男：嗨，玛丽。' },
      { en: 'W: Hi, Bob. You\'re an advocate of the tiny home movement. A lot of people don\'t know about this movement. Can you tell our audience what it\'s about?', zh: '女：嗨，鲍勃。你是微型住宅运动的倡导者。很多人对这项运动还不太了解。你能给我们的观众讲讲这到底是怎么回事吗？' },
      { en: 'M: Well, it\'s mainly about increasing home ownership and protecting the environment.', zh: '男：嗯，这项运动主要是为了提高住房自有率，并保护环境。' },
      { en: 'W: Of course, those are great goals. But I\'ve seen your blog, and you write about houses that are as small as 20 square meters. That\'s not a realistic size for families.', zh: '女：当然，这些都是很棒的目标。但我读过你的博客，你写的房子小到只有20平方米。对于家庭来说，这可不是个现实的面积。' },
      { en: 'M: I do talk about very small homes, but there\'s no set definition of a tiny home. And other people include homes that are much larger, say, 60 square meters. And you\'d be surprised. Many families of four are happy living in houses that are under 30 square meters.', zh: '男：我确实讨论过非常小的住宅，但微型住宅并没有一个固定的定义。其他人可能把面积大得多的住宅也算作微型住宅，比如说60平方米的。而且你会惊讶地发现，很多四口之家都乐于住在不到30平方米的房子里。' },
      { en: 'W: But I think most of us want spacious homes. The average new house in this area is 150 square meters. And that\'s what people dream of owning.', zh: '女：但我想我们大多数人都想要宽敞的家。我们这个地区新建住宅的平均面积是150平方米。这也是人们梦想拥有的房子大小。' },
      { en: 'M: Yes, but I think that dream needs to change, considering the cost of housing.', zh: '男：是的，但考虑到住房成本，我认为这个梦想需要改变。' },
      { en: 'W: Housing costs are high, but do people really save that much by having a smaller home?', zh: '女：住房成本确实很高，但人们真的能通过住更小的房子省下很多钱吗？' },
      { en: 'M: Absolutely. Many people who can only afford to rent a larger home are able to buy a tiny home. In this city, the average home costs $200,000, and a tiny home costs just $50,000.', zh: '男：当然能。很多只能租得起大房子的人，现在有能力买微型住宅了。在这个城市，普通住宅的价格是20万美元，而微型住宅只需5万美元。' },
      { en: 'W: Those are huge savings.', zh: '女：这可是笔巨大的节省。' },
      { en: 'M: So, tiny homes might not be for everyone, but they\'re a good option for many.', zh: '男：所以，微型住宅可能并不适合所有人，但对很多人来说，它们是个不错的选择。' },
      { en: 'W: You mentioned the environment earlier. How does this benefit the planet?', zh: '女：你刚才提到了环境。这对地球有什么好处呢？' },
      { en: 'M: Well, if people have smaller homes, they use less land and fewer resources to build them.', zh: '男：嗯，如果人们住更小的房子，他们建造房子时占用的土地和消耗的资源就会更少。' }
    ]
  },
  {
    id: 'cet4_listening_2024_12_03',
    title: 'Physical Activity for Children',
    cnTitle: '儿童体育活动',
    description: '听力原文：Kids need time every day to run, jump, stretch and play. These experiences have been shown to build ...',
    category: '教育',
    wordCount: 319,
    coverColor: 'bg-emerald-500',
    paragraphs: [
      { en: 'Kids need time every day to run, jump, stretch and play. These experiences have been shown to build children\'s confidence and pleasure in physical activities. Develop their motor skills and even improve emotional well being.', zh: '孩子们每天都需要时间来跑步、跳跃、伸展和玩耍。这些经历已被证明可以建立孩子对体育活动的信心和乐趣，发展他们的运动技能，甚至改善情绪健康。' },
      { en: 'To begin with, children seem to have a natural desire to overcome challenges and take risks. Taking healthy risks through physical movement builds children\'s confidence and ability to solve problems and persist through frustration.', zh: '首先，孩子们似乎天生就有克服挑战和冒险的渴望。通过身体运动承担健康风险，可以建立孩子的信心和解决问题以及坚持度过挫折的能力。' },
      { en: 'Secondly, movement activities build children\'s big body skills such as coordination and balance. As well as the fine motor skills they need for tasks like writing, tying their shoes, or throwing and catching a ball.', zh: '其次，运动活动可以培养孩子的身体大肌肉技能，如协调和平衡，以及他们需要用于写字、系鞋带或投掷和接球等任务的精细运动技能。' },
      { en: 'Thirdly, according to the American Psychological Association, regular physical activity, and especially outdoor activity, reduces children\'s stress and depression and improves their ability to focus and learn. Regular exercise can significantly improve self regulation and decrease disciplinary consequences for negative behavior. Physical activity provides a positive outlet for frustration, anxiety or anger and can become a healthy coping skill throughout life.', zh: '第三，根据美国心理协会的说法，定期的体育活动，尤其是户外活动，可以减少儿童的压力和抑郁，提高他们的专注和学习能力。定期锻炼可以显著改善自我调节能力，减少负面行为的纪律后果。体育活动为挫折、焦虑或愤怒提供了一个积极的宣泄口，并可以成为一生中健康的应对技能。' },
      { en: 'Finally, we know that physical activity is important for our physical and mental health and cultivating the habit of physical activity starts early. Children are more likely to develop a lifelong love of physical activity from frequent positive early experiences.', zh: '最后，我们知道体育活动对我们的身心健康很重要，而且培养体育活动习惯要从早期开始。孩子如果从早期频繁的积极经历中，更有可能培养对体育活动的终身热爱。' },
      { en: 'Not every child enjoys competitive sports or playing with balls, and that\'s okay. There are plenty of other options, such as imaginative play, noncompetitive games, and gardening or nature experiences.', zh: '不是每个孩子都喜欢竞技运动或球类运动，这没关系。还有很多其他选择，比如想象性游戏、非竞争性游戏，以及园艺或自然体验。' }
    ]
  },
  {
    id: 'cet4_reading_2025_06_01',
    title: 'Pandas and Research',
    cnTitle: '熊猫与研究',
    description: '阅读理解：New research suggests that pandas may have more secrets than previously thought. These beloved black...',
    category: '科技',
    wordCount: 320,
    coverColor: 'bg-violet-500',
    paragraphs: [
      { en: 'New research suggests that pandas may have more secrets than previously thought. These beloved black-and-white bears have long fascinated scientists and the public alike, but recent studies are revealing surprising new information about their behavior, diet, and conservation needs.', zh: '新研究表明，大熊猫可能有比以前认为的更多的秘密。这些受人喜爱的黑白熊长期以来一直让科学家和公众着迷，但最近的研究正在揭示关于它们行为、饮食和保护需求的令人惊讶的新信息。' },
      { en: 'Giant pandas are known for their specialized diet, consisting almost entirely of bamboo. However, researchers have discovered that pandas are more adaptable in their food choices than previously believed. Camera traps in the wild have captured footage of pandas consuming other plants and even small animals on occasion.', zh: '大熊猫以其专门的饮食而闻名，几乎完全由竹子组成。然而，研究人员发现大熊猫在食物选择上比以前认为的更具适应性。野外的相机陷阱拍摄到了大熊猫食用其他植物甚至小动物的镜头。' },
      { en: 'This dietary flexibility may be crucial for their survival in the face of climate change. As global temperatures rise, bamboo forests are shifting to higher elevations. Pandas that can supplement their diet with alternative food sources may have a better chance of adapting to these changes.', zh: '这种饮食灵活性对它们在面对气候变化时的生存可能至关重要。随着全球气温上升，竹林正在向更高海拔迁移。能够用替代食物补充饮食的大熊猫可能有更好的机会适应这些变化。' },
      { en: 'The research also sheds light on panda social behavior. Contrary to the long-held belief that pandas are solitary animals, new evidence suggests they may have more complex social structures than previously recognized. GPS tracking has revealed that individual pandas maintain regular contact with certain other pandas, forming what appear to be loose social networks.', zh: '这项研究还揭示了大熊猫的社会行为。与长期以来认为大熊猫是独居动物的观点相反，新证据表明它们可能比以前认识的具有更复杂的社会结构。GPS追踪显示，个体大熊猫与某些其他大熊猫保持定期联系，形成看似松散的社会网络。' },
      { en: 'Conservation efforts for pandas have made significant progress in recent decades. The wild panda population has increased, and their status was upgraded from \"endangered\" to \"vulnerable\" on the global species list. However, habitat fragmentation remains a major threat, and continued research is essential to ensure their long-term survival.', zh: '大熊猫的保护工作近几十年来取得了重大进展。野生大熊猫数量有所增加，它们在全球物种名单上的状态从\"濒危\"升级为\"易危\"。然而，栖息地碎片化仍然是一个重大威胁，持续的研究对确保它们的长期生存至关重要。' }
    ]
  },
  {
    id: 'cet4_reading_2025_06_02',
    title: 'American Obsession with Looks',
    cnTitle: '美国人对外貌的痴迷',
    description: '阅读理解：A fight is going on to remove pressure on women to conform to an absurd beauty ideal. For decades, w...',
    category: '健康',
    wordCount: 321,
    coverColor: 'bg-teal-500',
    paragraphs: [
      { en: 'A fight is going on to remove pressure on women to conform to an absurd beauty ideal. For decades, women have been bombarded with images of impossible beauty standards in magazines, movies, and advertising. This constant exposure has created a toxic culture where women feel they must look a certain way to be valued.', zh: '一场反对女性被迫符合荒谬美丽标准的斗争正在进行中。几十年来，女性一直被杂志、电影和广告中不可能达到的美丽标准形象所轰炸。这种持续的接触创造了一种有毒的文化，在这种文化中，女性感到她们必须以某种特定的方式看起来才能被重视。' },
      { en: 'The rise of social media has intensified this problem. The \"Instagram face\"—a homogenized look characterized by full lips, high cheekbones, and flawless skin—is now regarded as the new beauty ideal. Young women in particular are comparing themselves to carefully curated and heavily filtered images, leading to body dissatisfaction and low self-esteem.', zh: '社交媒体的兴起加剧了这一问题。\"Instagram面孔\"——一种以丰满的嘴唇、高颧骨和完美的皮肤为特征的同化外观——现在被视为新的美丽理想。年轻女性尤其将自己与精心策划和重度滤镜处理的图像进行比较，导致身体不满和自卑。' },
      { en: 'Research has shown that obsessive filtering has resulted in a tendency to regard one\'s body as an object of observation and judgment. This phenomenon, known as self-objectification, is linked to depression, anxiety, and disordered eating.', zh: '研究表明，过度的滤镜导致了一种将自己的身体视为观察和评判对象的倾向。这种现象被称为自我物化，与抑郁、焦虑和饮食失调有关。' },
      { en: 'The beauty industry profits from these insecurities, selling products that promise to fix supposed flaws. However, the problem is not individual appearance but a culture that values women primarily for how they look.', zh: '美容行业从这些不安全感中获利，销售承诺修复所谓缺陷的产品。然而，问题不在于个人外表，而在于一种主要根据女性外表来评价她们的文化。' },
      { en: 'Some progress is being made. Body positivity movements are challenging narrow beauty standards. More diverse representation in media is helping to expand definitions of beauty. However, the author argues that psychological intervention should be introduced to alleviate Americans\' obsession with looks. This could include media literacy education to help people critically analyze the images they consume, as well as mental health support for those struggling with body image issues.', zh: '一些进步正在取得。身体积极运动正在挑战狭隘的美丽标准。媒体中更多样化的表现形式正在帮助扩展美丽的定义。然而，作者认为应该引入心理干预来缓解美国人对外表的迷恋。这可能包括媒体素养教育，帮助人们批判性地分析他们接触到的图像，以及为那些与身体形象问题作斗争的人提供心理健康支持。' }
    ]
  },
  {
    id: 'cet4_listening_2025_06_01',
    title: 'Rush Hour Traffic',
    cnTitle: '高峰时段交通',
    description: '听力原文：M: Hey Mariah, you seem to be very much annoyed. What happened?...',
    category: '社会',
    wordCount: 299,
    coverColor: 'bg-blue-500',
    paragraphs: [
      { en: 'M: Hey Mariah, you seem to be very much annoyed. What happened?', zh: '男：嘿，玛丽亚，你看起来很烦躁。发生什么事了？' },
      { en: 'W: Rush hour in this city is killing me.', zh: '女：这个城市的交通高峰时段简直要了我的命。' },
      { en: 'M: Ah, yes. Rush hour is terrible, especially in the morning between 8 and 9. But what else can you expect in a city this big?', zh: '男：啊，是啊。高峰时段很糟糕，尤其是早上8点到9点之间。但在这么大的城市里，你还能指望什么呢？' },
      { en: 'W: Well, I think the local government could help improve things. I mean, getting rid of rush hour may be impossible. But it could be made more tolerable, don\'t you think?', zh: '女：嗯，我认为地方政府可以帮助改善情况。我是说，消除高峰时段可能是不可能的。但它可以变得更容易忍受，你不觉得吗？' },
      { en: 'M: Um, but I\'m not sure how.', zh: '男：嗯，但我不确定怎么做。' },
      { en: 'W: Well, for example, the subway system could have air conditioning. I know many cities in the world have air conditioning in their subway, so why can\'t we? It gets so hot in the summer, I can hardly breathe down there. And add to that, the rush hour crowds with strangers packed close together in the subway carriages. The whole thing is just horrible.', zh: '女：嗯，例如，地铁系统可以安装空调。我知道世界上很多城市的地铁都有空调，为什么我们不能呢？夏天太热了，我在下面几乎无法呼吸。再加上高峰时段的拥挤人群，陌生人挤在地铁车厢里。整个事情简直太可怕了。' },
      { en: 'M: Ah, yes, you are completely right. The trains here are too old. The government should definitely invest in new ones with air conditioning. I guess I\'m fortunate I take the bus instead.', zh: '男：啊，是的，你说得完全正确。这里的火车太旧了。政府绝对应该投资购买带空调的新火车。我想我很幸运改乘公交车了。' },
      { en: 'W: Oh, that\'s much better.', zh: '女：哦，那好多了。' },
      { en: 'M: Yeah, it\'s more convenient. Bus number 36 goes straight from my house to the office. It\'s a 30-minute ride and I don\'t have to make any changes.', zh: '男：是啊，更方便了。36路公交车从我家直达办公室。车程30分钟，不用换乘。' },
      { en: 'W: That sounds nice. I tell you, my current commute is killing me. Maybe I should move closer to the office.', zh: '女：听起来不错。告诉你，我目前的通勤简直要了我的命。也许我应该搬到离办公室更近的地方。' },
      { en: 'M: Well, I know a great housing agent. I found the flat I\'m living in now through him. And I love it.', zh: '男：嗯，我认识一个很棒的房屋中介。我现在住的公寓就是通过他找到的。我很喜欢。' },
      { en: 'W: Hmm. Could you send me his number please?', zh: '女：嗯。你能把他的电话号码发给我吗？' },
      { en: 'M: Sure thing. Just tell him exactly what you are looking for and I\'m sure he will find something good.', zh: '男：当然可以。只要告诉他你具体在找什么，我相信他会找到好东西的。' }
    ]
  },
  {
    id: 'cet4_listening_2025_06_02',
    title: 'Evolution of Human Sound',
    cnTitle: '人类声音的演变',
    description: '听力原文：Humans developed the ability to make sounds through evolution. People initially made sounds by imita...',
    category: '科技',
    wordCount: 65,
    coverColor: 'bg-amber-500',
    paragraphs: [
      { en: 'Humans developed the ability to make sounds through evolution. People initially made sounds by imitating animals and natural phenomena around them. Making sounds helps one communicate with people they can\'t see, which was particularly important in early human societies when people needed to coordinate activities over distances.', zh: '人类通过进化发展了发出声音的能力。人们最初通过模仿周围的动物和自然现象来发出声音。发出声音有助于人与看不见的人交流，这在早期人类社会中尤为重要，因为人们需要协调远距离的活动。' }
    ]
  },
  {
    id: 'cet4_listening_2025_06_03',
    title: 'Teamwork and Competition',
    cnTitle: '团队合作与竞争',
    description: '听力原文：The passage discusses human attitudes toward teamwork and competition. People are somewhat selfish b...',
    category: '教育',
    wordCount: 67,
    coverColor: 'bg-emerald-500',
    paragraphs: [
      { en: 'The passage discusses human attitudes toward teamwork and competition. People are somewhat selfish by nature, but they also have the capacity for cooperation. Teamwork became important when people wanted to have competitive team members to achieve common goals. The key lesson is that people should consider the consequences before acting.', zh: '这篇文章讨论了人类对团队合作和竞争的态度。人天生有些自私，但他们也有合作的能力。当人们想要有竞争力的团队成员来实现共同目标时，团队合作变得重要。关键的教训是人们应该在行动之前考虑后果。' }
    ]
  },
  {
    id: 'cet4_listening_2025_06_04',
    title: 'History of Animal Imagery in Art',
    cnTitle: '艺术中动物形象的历史',
    description: '听力原文：The passage explores the history of animal imagery in art. Early art contained more images of animal...',
    category: '文化',
    wordCount: 60,
    coverColor: 'bg-rose-500',
    paragraphs: [
      { en: 'The passage explores the history of animal imagery in art. Early art contained more images of animals than humans. In many ancient cultures, animals were revered and kept by royalty. Some animals were used to show off riches and power. In some cases, art featuring animals was part of the royal estate.', zh: '这篇文章探讨了艺术中动物形象的历史。早期艺术中包含的动物形象比人类更多。在许多古代文化中，动物受到尊敬，由皇室饲养。一些动物被用来炫耀财富和权力。在某些情况下，以动物为主题的艺术是皇家产业的一部分。' }
    ]
  }
];


// 为每篇文章补充 year / type / region / level 字段（从 id 中解析）
rawMockArticles.forEach(a => {
  const parts = a.id.split('_')
  if (!a.year && parts.length >= 3) a.year = parseInt(parts[2], 10)
  if (!a.type && parts.length >= 2) a.type = parts[1]
  if (!a.region) a.region = '全国'
  if (!a.level && !a.id.startsWith('extra_')) a.level = 'cet4'
})

// 处理高考数据
const gaokaoArticles = gaokaoRaw.map(a => {
  const match = a.id.match(/gk(\d{4})/)
  return {
    ...a,
    year: match ? parseInt(match[1], 10) : 2020,
    type: 'reading',
    region: '全国',
    level: 'gaokao',
  }
})

// 处理 CET-6 数据
function getCet6Year(index) {
  if (index < 5) return 2024
  return 2025
}

const cet6Articles = cet6Raw.map((a, index) => ({
  ...a,
  year: getCet6Year(index),
  type: 'reading',
  region: '全国',
  level: 'cet6',
}))

export const mockArticles = [...extraArticles, ...rawMockArticles, ...gaokaoArticles, ...cet6Articles, ...articles2026]
  .sort((a, b) => b.year - a.year)

// 辅助导出
const allCategories = [...new Set(mockArticles.map(a => a.category))].sort()
export const categories = ['全部', ...allCategories]

const allYears = [...new Set(mockArticles.map(a => a.year))].sort((a, b) => b - a)
export const years = ['全部', ...allYears]

const allRegions = [...new Set(mockArticles.map(a => a.region))].sort()
export const regions = ['全部', ...allRegions]

const allLevels = [...new Set(mockArticles.map(a => a.level))].sort()
export const levels = ['全部', 'cet4', 'gaokao', 'cet6']

export const types = ['全部', 'reading', 'listening']

export function getArticleById(id) {
  return mockArticles.find(a => a.id === id)
}

export function estimateReadingMinutes(wordCount) {
  return Math.max(1, Math.round(wordCount / 200))
}
