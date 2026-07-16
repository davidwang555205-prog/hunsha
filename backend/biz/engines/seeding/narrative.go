package seeding

// characterMoodOpenings 翻译自 TS :1574-1659
var characterMoodOpenings = map[string][]NarrativeTemplate{
	"bridal": {
		func(ctx NarrativeTemplateContext) string {
			return "她刚换好衣服时没有马上看镜头，先低头把裙摆往前拨了一点，说自己其实还是担心" + ctx.ConcernCue + "。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "如果是我在店里记录这组图，我会从" + ctx.AudienceCue + "站到镜子前那几秒开始写。她手还扶着腰线，眼神没有立刻放松。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "那天她进试纱间前一直在翻手机相册，截图看了很多遍，真正上身后反而先摸了摸肩带，说想再看清" + ctx.FocusCue + "。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "她不是一进来就说要哪件的人，换好婚纱以后先安静站了一会儿，像是在确认" + ctx.ConcernCue + "会不会真的影响自己。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "这位" + ctx.AudienceCue + "的状态很真实，嘴上说都可以试，身体却一直有点紧，手指会下意识去碰肩带和腰侧。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "我记得她走出来的时候没有笑得很夸张，只是先看镜子里的" + ctx.FocusCue + "，然后轻轻问了一句这样会不会太满。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "试纱最容易被第一眼带走，但她那天没有急着说喜欢，先让顾问等等，自己低头看了看" + ctx.ConcernCue + "相关的位置。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "有些" + ctx.AudienceCue + "不是不确定审美，是还没找到身体放松的那一下。她站出来的时候，肩膀还是微微提着。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "这组记录我不想从“好美”开始写，想从她慢慢转身那一刻开始。那一下，" + ctx.FocusCue + "比表情更先被看见。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "她说自己来之前做了很多功课，但换上以后第一个反应不是拍照，而是站在镜子前停住，看" + ctx.ConcernCue + "有没有被放大。"
		},
	},
	"phone": {
		func(ctx NarrativeTemplateContext) string {
			return "她拿起手机时先往旁边挪了一点，不是为了找最好看的角度，是怕" + ctx.ConcernCue + "。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "这组自拍没有开广角。她站到镜子前，先确认手机没有挡住" + ctx.FocusCue + "，才按下第一张。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "给" + ctx.AudienceCue + "看的试纱记录，开头就应该普通一点。手机举起来，裙摆还没完全铺好，这反而像真的。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "她说店拍当然好看，但回家真正反复看的，还是手机里那几张能看清" + ctx.ConcernCue + "的照片。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "第一张自拍有点歪，她没删。因为那张刚好拍到了" + ctx.FocusCue + "，比摆好的照片更能复盘。"
		},
		func(ctx NarrativeTemplateContext) string {
			return ctx.AudienceCue + "很容易在试纱间上头，所以我会先让她拍一张最普通的镜前全身。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "她把手机从胸口旁边移开一点，又重新站直。这个小动作，是为了别让" + ctx.ConcernCue + "干扰判断。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "试纱自拍不需要像大片。手机拿稳、脚别往前伸，先把" + ctx.FocusCue + "留下来。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "她原本担心" + ctx.ConcernCue + "，所以没有只拍正面，又补了一张侧身和一段走动。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "如果是" + ctx.AudienceCue + "第一次试纱，我会提醒她：先拍给自己看，不是拍给别人夸。"
		},
	},
	"prep": {
		func(ctx NarrativeTemplateContext) string {
			return "试纱前一天，她把胸贴、鞋和发圈都放到包旁边，才发现自己最担心的其实是" + ctx.ConcernCue + "。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "这类准备不用写得很吓人。先把" + ctx.FocusCue + "记下来，第二天到店就不会全靠临场反应。"
		},
		func(ctx NarrativeTemplateContext) string {
			return ctx.AudienceCue + "出门前最需要的不是一长串攻略，是几件真的会用到的小东西。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "她本来想一天约三家，写清" + ctx.ConcernCue + "以后，反而把行程删掉了一半。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "准备清单摊在桌上时，最有用的不是东西多，而是" + ctx.FocusCue + "有没有先想好。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "给" + ctx.AudienceCue + "的提醒可以简单一点：吃点东西，穿舒服的鞋，把问题写下来。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "很多慌乱不是因为不懂婚纱，是到店后才想起" + ctx.ConcernCue + "还没问。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "她把手机备忘录打开，只写了三行：场地、预算、" + ctx.FocusCue + "。够用了。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "试纱当天情绪很容易满，提前面对" + ctx.ConcernCue + "，到店后会轻一点。"
		},
		func(ctx NarrativeTemplateContext) string {
			return ctx.AudienceCue + "不用把自己准备成完美状态，只要带着问题去。"
		},
	},
	"companion": {
		func(ctx NarrativeTemplateContext) string {
			return "陪她试纱那天，我先看见的不是裙摆，是她一直回头确认大家的反应。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "朋友坐在旁边其实很容易看出来，" + ctx.FocusCue + "出现时，她整个人会先松一下。"
		},
		func(ctx NarrativeTemplateContext) string {
			return ctx.AudienceCue + "不要急着给答案，先看她站到镜子前有没有自然一点。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "妈妈没有马上评价好不好看，只是先帮她理头纱。那一下，" + ctx.ConcernCue + "反而没那么重。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "我负责拍视频，所以会比她更清楚" + ctx.FocusCue + "是不是只在正面成立。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "给" + ctx.AudienceCue + "的记录，不用拍成剧情。旁边人的安静反应就够真实。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "她一开始很在意" + ctx.ConcernCue + "，后来走了两步，自己先笑了一下。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "陪试的人最好少说“都好看”，多帮她看" + ctx.FocusCue + "这种具体地方。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "伴侣坐在旁边没有插话，只在她反复问意见时提醒她刚才一直在笑。"
		},
		func(ctx NarrativeTemplateContext) string {
			return ctx.AudienceCue + "其实是帮她留证据的人，不是替她决定的人。"
		},
	},
	"brand": {
		func(ctx NarrativeTemplateContext) string {
			return "这组新品我不想从“高级”两个字开始。先把" + ctx.FocusCue + "放出来，能看懂再谈喜欢。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "拍发布图前，我们先把" + ctx.ConcernCue + "拿出来看了一遍，避免一组图只剩漂亮。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "样衣挂在架子上时很安静，真正需要说清的是" + ctx.MaterialCue + "，不是给它套一句命定。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "这件上身以后，团队先看" + ctx.FocusCue + "，没有急着定主图。婚纱发布不能只靠第一眼。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "如果一组新品让人看完还在想" + ctx.ConcernCue + "，那文案再漂亮也没用。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "我会先发一张没那么热闹的图，让" + ctx.MaterialCue + "自己露出来，少一点口号。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "这一季的线条不复杂，所以更要把" + ctx.FocusCue + "拍清楚。简单款最怕说空话。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "发布前我们删掉了几句太满的描述，留下能回答" + ctx.ConcernCue + "的画面。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "近看" + ctx.MaterialCue + "时，才知道这件该怎么讲。远景负责好看，近景负责诚实。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "这不是一组只求氛围的新品图。第一张要让人看见" + ctx.FocusCue + "，后面才接得住。"
		},
	},
	"store": {
		func(ctx NarrativeTemplateContext) string {
			return "今天店里第一组图没有拍满墙婚纱，先拍了她说起自己怕" + ctx.ConcernCue + "的那几分钟。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "顾问没有急着拿最贵的款，先坐下来听她说完。这个过程里，" + ctx.FocusCue + "比空间图更值得拍。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "给" + ctx.AudienceCue + "看的门店记录，开头不用太热闹。预约卡、镜子和一段沟通就够了。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "她进门前其实有点担心" + ctx.ConcernCue + "，所以顾问先把流程说清楚，没有马上推进试穿。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "这组想记录的不是店有多大，而是" + ctx.FocusCue + "有没有发生在真实服务里。"
		},
		func(ctx NarrativeTemplateContext) string {
			return ctx.AudienceCue + "最想知道的不是橱窗有多美，是进店以后会不会被好好听见。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "拍到一半我停了一下，把会露出隐私的东西移开。门店日常再真实，也要照顾" + ctx.ConcernCue + "。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "客人站在镜前时，顾问退后了半步。这个距离感，刚好能说明" + ctx.FocusCue + "。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "她没有被催着马上定，先把" + ctx.ConcernCue + "讲出来。这个片段比一排裙子更像店里的真实一天。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "如果我是" + ctx.AudienceCue + "，我会想先看到试纱间的光、镜子和顾问怎么说话。"
		},
	},
	"dress": {
		func(ctx NarrativeTemplateContext) string {
			return "她出门前在入户镜前站了一会儿，没有急着拎包，先低头看裙摆和鞋子的距离，像是在确认" + ctx.ConcernCue + "。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "这条记录更像" + ctx.AudienceCue + "出门前的自检，不是摆好姿势拍一张，而是穿上以后先走两步。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "她把外套搭在手臂上，又回到镜子前看了一眼" + ctx.FocusCue + "，表情不是惊喜，是终于不用再调整。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "很多日常裙装不是第一眼决定的，她那天先坐下，再站起来，才开始判断" + ctx.ConcernCue + "会不会打扰自己。"
		},
		func(ctx NarrativeTemplateContext) string {
			return ctx.AudienceCue + "最真实的状态，是早上没有太多时间纠结。她把头发随手别到耳后，先看裙子能不能跟上今天的日程。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "拍这组的时候，她没有故意凹姿势，只是在门口停了一下，用手顺了顺" + ctx.FocusCue + "附近的线条。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "她原本担心" + ctx.ConcernCue + "，所以没有直接出门，先在镜子前转了半圈，看裙摆有没有跟着身体走。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "如果写给" + ctx.AudienceCue + "看，我会从换鞋那一步写起。鞋跟一变，裙长和腰线的感觉马上就不一样。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "这条裙子不是靠第一眼热闹留住人的，她站在窗边整理袖口时，反而更能看清" + ctx.FocusCue + "。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "她试完没有马上说好看，只是把包换到另一边肩上，看" + ctx.ConcernCue + "在真实动作里还会不会出现。"
		},
	},
}

// environmentDetails 翻译自 TS :1661-1746
var environmentDetails = map[string][]NarrativeTemplate{
	"bridal": {
		func(ctx NarrativeTemplateContext) string {
			return "试纱间里很安静，窗帘只拉到一半，软光落在镜子边缘。这一版要留住的" + ctx.SceneCue + "，不需要拍得很满。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "顾问把灯调低了一点，镜子旁边只留了衣架和一张小凳子。" + ctx.SceneCue + "在这种环境里会更像真实记录。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "窗边那一角有一点柔光，珠片轻轻反光，但不是刺眼的亮。站近了看，" + ctx.SceneCue + "也没有被环境抢走。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "试纱间门关上以后，外面的声音变小，只剩裙摆拖过地毯的声音。" + ctx.SceneCue + "就在这个安静里慢慢出现。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "镜子旁边的纱帘有一点褶，空间没有被收拾成样板间。这样看" + ctx.SceneCue + "，反而更像真实预约。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "旁边的椅子上放着头纱和鞋，没有多余装饰。视线自然回到她身上，也回到" + ctx.SceneCue + "。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "窗边光从侧面进来，白纱不会糊成一片，钉珠和蕾丝都有细小阴影。" + ctx.SceneCue + "也因此更清楚。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "朋友坐在沙发边没有说话，房间里有一小段停顿。比起热闹地夸，" + ctx.SceneCue + "在这种时候更真实。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "顾问蹲下整理拖尾时，镜面刚好照到侧面比例。这个角度适合看" + ctx.SceneCue + "，也比正面更诚实。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "桌上有预约卡、面料小样和一束没拆开的头纱，都是很小的东西。它们让" + ctx.SceneCue + "像真的发生过。"
		},
	},
	"phone": {
		func(ctx NarrativeTemplateContext) string {
			return "镜子旁边有一点窗帘影子，地面线也在，没有被修得太干净。" + ctx.SceneCue + "放在这样的画面里才有参考。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "试纱间灯光偏软，手机拍出来不是特别亮，但腰线和裙摆还清楚。" + ctx.SceneCue + "不用追求完美。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "她把手机举到胸口旁边，镜子里能看到完整拖尾。" + ctx.SceneCue + "看起来很普通，却适合回家慢慢看。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "背景里能看到衣架和纱帘，空间不乱，也不像刻意布景。" + ctx.SceneCue + "因此更像真实试纱。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "顾问退到画面外，只留一点手部整理裙摆的痕迹。" + ctx.SceneCue + "还是主角，手机也没有挡住结构。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "镜前那块地毯没有被裁掉，脚和裙摆的位置都能看见。判断" + ctx.SceneCue + "时，这些小地方很有用。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "手机相册里的缩略图排在一起，正面、侧面和走动都有。" + ctx.SceneCue + "不是为了出片，是为了对比。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "那天店里不算吵，只有顾问整理拖尾的声音。" + ctx.SceneCue + "就在这种很日常的间隙里留下来。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "镜子边缘有一点反光，手机画面没有开滤镜。这样看" + ctx.SceneCue + "，比例比较接近真实。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "她拍完没有立刻发出去，而是坐到旁边翻了几张。" + ctx.SceneCue + "在相册里并排看，差别会更明显。"
		},
	},
	"prep": {
		func(ctx NarrativeTemplateContext) string {
			return "桌面上没有摆太多东西，只有预约卡、鞋、胸贴和一支笔。" + ctx.SceneCue + "放在这里，很像出门前最后看一遍。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "试纱前的房间很安静，手机备忘录还亮着。" + ctx.SceneCue + "不是攻略封面，是明天真的要用的记录。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "鞋盒开着，头纱照片存在相册里，包还没拉上。" + ctx.SceneCue + "就停在这个出门前的小空隙。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "她把清单写在便签纸上，没有做得很精致。" + ctx.SceneCue + "越普通，越像真的会被带去店里。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "桌角有一杯水，旁边是无痕内裤和接近婚礼高度的鞋。" + ctx.SceneCue + "看起来琐碎，但很实用。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "预约时间、预算和场地被写在同一页上。" + ctx.SceneCue + "让试纱当天少一点临时慌乱。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "镜前先试了一下鞋高，裙子还没穿上，比例问题已经能提前想一遍。" + ctx.SceneCue + "就从这里开始。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "包里留了一个小文件夹，放试纱记录和面料小样。" + ctx.SceneCue + "不漂亮，但会帮上忙。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "她没有把一天排得很满，日历上只留了两家店。" + ctx.SceneCue + "看起来松一点，判断也会清楚一点。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "试纱间入口还没出现，准备已经开始了。" + ctx.SceneCue + "不是焦虑，是给自己留一点余地。"
		},
	},
	"companion": {
		func(ctx NarrativeTemplateContext) string {
			return "试纱间沙发不大，朋友坐在侧面，手机一直横着拿。" + ctx.SceneCue + "就在这种角度里更真实。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "妈妈坐在旁边，没有急着说话，手里还拿着刚取下来的头纱。" + ctx.SceneCue + "不需要很热闹。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "顾问整理裙摆时，陪试的人刚好能看到背影。" + ctx.SceneCue + "比正面照多了一层判断。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "镜子里除了她，还有旁边人安静看着的影子。" + ctx.SceneCue + "像真实试纱，不像排练好的剧情。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "手机里回放上一件婚纱时，几个人都凑近了一点。" + ctx.SceneCue + "让意见变得具体。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "候场区的灯不亮，声音也低。" + ctx.SceneCue + "在这种环境里不会被夸张情绪盖掉。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "朋友从侧面拍她走两步，脚下地毯和拖尾都在画面里。" + ctx.SceneCue + "能看出真实行动感。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "配饰台上头纱还没收回去，旁边放着试纱记录表。" + ctx.SceneCue + "看起来像刚刚发生。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "伴侣坐得有点拘谨，但看得很认真。" + ctx.SceneCue + "里那一点不熟练，反而很真实。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "几个人一起看镜子时，没有人抢着下结论。" + ctx.SceneCue + "就在这个停顿里。"
		},
	},
	"brand": {
		func(ctx NarrativeTemplateContext) string {
			return "拍摄台上只放了样衣、面料卡和一张草图，东西不多。" + ctx.SceneCue + "留一点空，系列线索反而更清楚。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "窗边光落在挂装上，白纱没有糊成一片。" + ctx.SceneCue + "不需要布置得很华丽，先把结构拍准。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "lookbook 的背景压得很干净，但没有把房间修到失真。" + ctx.SceneCue + "要看得出是婚纱，不是海报。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "样衣最后确认时，桌上还有没收起来的钉珠道具和线剪。" + ctx.SceneCue + "在这种过程里更可信。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "橱窗光很轻，挂装的影子落在地面上。" + ctx.SceneCue + "不吵，适合把新品慢慢看完。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "拍完整上身前，团队先看了侧面和背影。" + ctx.SceneCue + "不是补充图，它会影响这件怎么被理解。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "mood board 没有占满画面，只露出一点纸张边缘。" + ctx.SceneCue + "还是围着衣服走。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "酒店晨光那组保留了窗框和地毯线，婚纱的比例没有被拉长。" + ctx.SceneCue + "因此更像可参考的新品图。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "草坪那张没有把绿色调得很浓，白纱边缘还能看见层次。" + ctx.SceneCue + "也没有被背景吞掉。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "发布图里可以有一点安静，不必每张都像封面。" + ctx.SceneCue + "留给人慢慢看就好。"
		},
	},
	"store": {
		func(ctx NarrativeTemplateContext) string {
			return "试纱间门半开着，里面能看到镜子、纱帘和一排衣架。" + ctx.SceneCue + "不豪华，但看着让人知道会怎么开始。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "桌上放着预约卡和面料小样，手机屏幕被避开了。" + ctx.SceneCue + "看起来普通，反而让人安心。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "顾问整理裙摆时没有贴得太近，画面里留了距离。" + ctx.SceneCue + "能看见服务，也不会让人紧张。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "候场区的椅子、鞋盒和头纱都在原位，干净但没有装成样板间。" + ctx.SceneCue + "像真实营业的一天。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "橱窗那一面光很柔，挂着的婚纱没有被拍成一片白。" + ctx.SceneCue + "让人先看清款式。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "朋友坐在旁边翻视频，顾问在等客人自己开口。" + ctx.SceneCue + "里那点停顿很重要。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "配饰台上有头纱、耳饰和手套，摆得清楚，不抢画面。" + ctx.SceneCue + "是服务的一部分。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "试纱结束后，记录表还放在桌边。" + ctx.SceneCue + "不是摆拍道具，是刚刚用过的东西。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "镜子前的光没有过曝，白纱和人的肤色都正常。" + ctx.SceneCue + "能让预约前的人少猜一点。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "这家店的日常不需要拍得很忙。" + ctx.SceneCue + "干净、具体，就比空口说专业更好。"
		},
	},
	"dress": {
		func(ctx NarrativeTemplateContext) string {
			return "窗边的光不强，有一点灰调，裙子的颜色在日常光里反而更容易看准。" + ctx.SceneCue + "不用被拍成大片。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "她没有把背景收得太干净，桌角、包带和鞋尖都留了一点生活痕迹。这样看" + ctx.SceneCue + "更可信。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "地面线条和镜子边框都还在，比例没有被修得太完美。" + ctx.SceneCue + "在这种画面里更接近真实出门前。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "咖啡杯放在手边，下午的光慢慢落下来。" + ctx.SceneCue + "有一点松弛，但没有甜到失真。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "电梯门快合上时她看了一眼镜子，金属反光让线条更清楚，也让" + ctx.SceneCue + "像随手记录。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "画面里没有太多道具，只有窗光、椅背和一小块地毯。少一点布置，" + ctx.SceneCue + "反而被看见。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "街角风有一点轻，裙摆不是刻意甩起来的，是走路时自然晃了一下。" + ctx.SceneCue + "也跟着变得轻。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "她坐下的时候没有刻意挺直，桌边高度刚好能看出腰腹会不会紧。" + ctx.SceneCue + "只是背景，真实动作才是这一段的重点。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "衣帽间的门半开着，挂装和上身状态放在一起。这样看" + ctx.SceneCue + "，不像只为拍照存在。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "白墙和留白很多，反而能把肩颈、腰线和裙长看得更稳。" + ctx.SceneCue + "不用靠复杂背景。"
		},
	},
}

// productObservationDetails 翻译自 TS :1748-1833
var productObservationDetails = map[string][]NarrativeTemplate{
	"bridal": {
		func(ctx NarrativeTemplateContext) string {
			return "上身后先看方领和细肩带，领口没有顶住脖子，肩带也没有勒进肩膀。再回头看" + ctx.FocusCue + "，会比第一眼更准。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "腰线的位置比想象中重要，裙摆从腰侧往下落，没有立刻膨出去。" + ctx.MaterialCue + "也要放在这个比例里一起看。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "近一点会发现，白纱不是一整片平的白。蕾丝、钉珠和花朵层次在光里有起伏，" + ctx.MaterialCue + "也更容易被看见。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "她用手摸了一下肩带，又低头看拖尾边缘。" + ctx.FocusCue + "不是靠修图判断的，站在那里就能看出一点。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "裙摆展开时没有很夸张，拖尾的长度刚好留在镜子里。灯光没有把" + ctx.MaterialCue + "吃掉，这点很重要。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "顾问用钉珠道具调整腰线后，前后差别很明显。再看" + ctx.FocusCue + "和" + ctx.MaterialCue + "，就不只是口头解释。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "如果只看远景会漏掉很多细节，胸口弧度、腰后的余量、钉珠和" + ctx.MaterialCue + "，都要近一点才看得出来。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "她转身的时候，背后拉链、腰线和拖尾会一起进入镜子。" + ctx.FocusCue + "在这个动作里比站定时更真实。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "这件最耐看的地方不是裙摆多大，而是肩颈、腰线和" + ctx.MaterialCue + "之间有呼吸感，没有把人压住。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "手机拍到的那张没有特别精致，但领口、腰线、裙摆和拖尾都在。" + ctx.FocusCue + "反而更容易回家复盘。"
		},
	},
	"phone": {
		func(ctx NarrativeTemplateContext) string {
			return "手机别举得太中间，领口和腰线要露出来。" + ctx.FocusCue + "如果被手机挡住，回家就很难判断。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "普通镜头下，缎面和蕾丝不会像店拍那么亮，但" + ctx.MaterialCue + "还在，这张就值得留。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "侧身自拍会把" + ctx.FocusCue + "和" + ctx.MaterialCue + "一起带出来，尤其是拖尾有没有压人，一眼就能看见。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "近拍腰线时能看到钉珠道具的位置，也能看到" + ctx.MaterialCue + "。这些小细节比滤镜更有用。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "她补了一段十秒走动，裙摆有没有跟着身体走，" + ctx.FocusCue + "会比静态自拍更清楚。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "自拍里不要把裙摆裁掉，拖尾边缘和" + ctx.MaterialCue + "都要留在画面里。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "如果开广角，腿会被拉长，" + ctx.FocusCue + "也会跟着失真。正常镜头虽然普通，但更接近现场。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "手机相册里几张放在一起看，" + ctx.MaterialCue + "的差别会比单独看一张明显很多。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "她把手机换到另一只手，又拍了一张不挡胸口的。" + ctx.FocusCue + "终于完整了。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "屏幕不要露聊天，也不要露预约信息。画面只需要留下婚纱、镜子和" + ctx.MaterialCue + "。"
		},
	},
	"prep": {
		func(ctx NarrativeTemplateContext) string {
			return "清单里最该写清的是" + ctx.FocusCue + "，旁边再放" + ctx.MaterialCue + "，到店后顾问会更快理解你。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "鞋高、胸贴和无痕内裤不是小事，" + ctx.MaterialCue + "会直接影响试出来的比例。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "每件婚纱都拍同角度，才看得出" + ctx.FocusCue + "有没有变化，不然回家很容易乱。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "头纱、发型和鞋一起试，" + ctx.MaterialCue + "会更接近婚礼当天，不会只停在试纱间。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "先把预算和场地说清楚，再看款式。" + ctx.FocusCue + "不写下来，到店很容易被漂亮裙子带走。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "近看蕾丝、缎面和白纱，不是挑刺，是确认" + ctx.MaterialCue + "在现场也能成立。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "坐下、转身、走两步都要试。" + ctx.FocusCue + "如果只靠站定判断，会漏掉很多。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "钉珠道具调整出的临时腰线可以拍下来，" + ctx.MaterialCue + "和最终改尺寸会有关。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "每试完一件写两句话就够：喜欢哪里，犹豫哪里。" + ctx.FocusCue + "会慢慢浮出来。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "客照授权和隐私边界也提前问，" + ctx.MaterialCue + "之外，这些细节也会影响体验。"
		},
	},
	"companion": {
		func(ctx NarrativeTemplateContext) string {
			return "陪试的人更容易看到背影和侧面，头纱、肩线和拖尾不能只靠她自己在镜子里猜。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "妈妈会先注意头纱、敬茶动作和" + ctx.MaterialCue + "，这些往往比一句好看更实际。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "朋友拍的走动视频很有用，" + ctx.FocusCue + "在动作里会比站定时清楚。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "伴侣可能说不出专业词，但能看见" + ctx.MaterialCue + "是不是和场地搭。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "她自己看不到背后的拉链和拖尾，" + ctx.FocusCue + "就需要旁边的人补一眼。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "同一角度拍几件以后，" + ctx.MaterialCue + "的差别不用争，翻相册就能看出来。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "如果她一直整理肩带，" + ctx.FocusCue + "大概率还没让她真正放松。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "头纱叠上去以后，肩颈和" + ctx.MaterialCue + "会一起变化，陪试的人最好也拍下来。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "少说“显瘦”，多说" + ctx.FocusCue + "。具体一点，她才不会越听越乱。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "坐下那一刻很容易被漏掉，" + ctx.MaterialCue + "在这个动作里会变得很诚实。"
		},
	},
	"brand": {
		func(ctx NarrativeTemplateContext) string {
			return "这件的重点在" + ctx.FocusCue + "，不是把裙摆拍大。近景里的" + ctx.MaterialCue + "要接得上完整上身。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "挂装时先看" + ctx.MaterialCue + "，上身后再看腰线。两张图能对上，发布才不空。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "方领、细肩带、收腰和拖尾要连着看。" + ctx.FocusCue + "如果只靠一句形容，很快就会飘。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "蕾丝和钉珠不能只在远处闪一下，" + ctx.MaterialCue + "近看也要干净。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "侧面图保留下来，是因为" + ctx.FocusCue + "在正面不一定看得全。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "强光下白纱最容易糊掉，所以这组把" + ctx.MaterialCue + "压在柔光里拍。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "新品不需要每件都说适合所有人。看完" + ctx.FocusCue + "，适不适合其实会清楚很多。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "样衣调整后的腰线和" + ctx.MaterialCue + "放在一起，能看出这件不是只为封面存在。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "背影不是补图。拉链、肩线和拖尾展开以后，" + ctx.FocusCue + "才算完整。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "如果一组发布没有" + ctx.MaterialCue + "，只剩氛围，备婚的人很难拿它做判断。"
		},
	},
	"store": {
		func(ctx NarrativeTemplateContext) string {
			return "顾问拿款前先问场地和预算，" + ctx.FocusCue + "不是写在文案里的，是这几分钟里发生的。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "试纱间的光要正常，镜子也要正常。" + ctx.MaterialCue + "如果在现场看不清，照片再美都没用。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "整理裙摆时，顾问会顺手检查" + ctx.MaterialCue + "。这个动作能看出" + ctx.FocusCue + "是不是落到细节里。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "头纱、耳饰和手套放在台面上，不需要堆满。" + ctx.MaterialCue + "清楚，搭配就不会乱。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "客照发布前确认授权，这一步很小，但" + ctx.FocusCue + "会让人放心很多。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "面料小样和改尺寸记录留在桌上，" + ctx.MaterialCue + "不是摆设，是沟通时真的会用到。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "如果店铺只拍空间，" + ctx.FocusCue + "就会缺一块。顾问怎么听、怎么调整，都要被看见一点。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "橱窗图负责第一眼，" + ctx.MaterialCue + "负责让人知道进店后能看到什么。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "朋友回看视频时，顾问没有插话催单。" + ctx.FocusCue + "有时候就在这种安静里。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "试完以后记录理由，比只说好看更实在。" + ctx.MaterialCue + "和选择原因放在一起，才像真实门店。"
		},
	},
	"dress": {
		func(ctx NarrativeTemplateContext) string {
			return "上身后先看" + ctx.MaterialCue + "，再看" + ctx.FocusCue + "，这两个地方决定它是日常好穿，还是只适合拍一张图。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "她低头顺了一下裙摆，腰线没有往上跑，" + ctx.FocusCue + "在走路时也没有乱掉。"
		},
		func(ctx NarrativeTemplateContext) string {
			return ctx.MaterialCue + "不是那种很用力的质感，坐下以后还有自然褶皱，反而更像会被经常穿出门。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "领口和肩线都很干净，" + ctx.FocusCue + "没有抢掉人的状态，" + ctx.MaterialCue + "在窗边光里也不显廉价。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "裙长刚好露出鞋面一点，" + ctx.MaterialCue + "垂下来时没有贴得太死，走动会有很小的摆幅。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "换一双鞋再看，" + ctx.FocusCue + "的差别就出来了，这比单独夸显瘦更有用。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "近景里能看见" + ctx.MaterialCue + "，线头和褶裥没有被过度磨皮，日常感保留得比较好。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "她坐下时没有一直拉裙摆，" + ctx.FocusCue + "说明这条不是只能站着好看。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "外套搭上去以后，" + ctx.MaterialCue + "没有被压没，裙子的轮廓还在，场景就能自然切换。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "镜前那张最普通，但肩颈、腰线、裙长都清楚，" + ctx.FocusCue + "比精修氛围更能说明问题。"
		},
	},
}

// emotionalTurns 翻译自 TS :1835-1920
var emotionalTurns = map[string][]NarrativeTemplate{
	"bridal": {
		func(ctx NarrativeTemplateContext) string {
			return "后来她没有急着换下一件，而是让朋友帮她拍了" + ctx.ProofCue + "，看完才慢慢笑了一下。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "顾问没有急着评价，只是把裙摆铺平，又提醒她按自己的节奏看。她后来记住的不是一句夸奖，而是" + ctx.ServiceCue + "。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "真正变化是在她转身以后，" + ctx.ProofCue + "让她自己也看见了，不用别人一直解释。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "她原本还在问" + ctx.ConcernCue + "，但走了两步以后，语气就轻了很多。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "现场没有人催她决定，顾问只是陪她把正面、侧面和背影都看了一遍。" + ctx.ServiceCue + "也变成了很具体的一步。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "看到" + ctx.ProofCue + "那一刻，她没有说命定，只是很小声地说，这件好像不用一直调整。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "前面几件她都在纠结" + ctx.ConcernCue + "，这一件穿上后，她先问的是能不能再试一下头纱。"
		},
		func(ctx NarrativeTemplateContext) string {
			return ctx.ProofCue + "留下来以后，朋友的意见也变具体了，不再只是“好看”两个字。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "顾问蹲下整理拖尾的时候，她低头看了很久。比起一句夸奖，" + ctx.ServiceCue + "留下的过程更能说明状态。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "她从镜子里看了正面，又侧过身看背影，关于" + ctx.ConcernCue + "的紧张慢慢少了一点。"
		},
	},
	"phone": {
		func(ctx NarrativeTemplateContext) string {
			return "拍到" + ctx.ProofCue + "以后，她没有马上发给朋友，而是自己先看了一遍，语气明显稳了。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "原本一直担心" + ctx.ConcernCue + "，等正面和侧身放在一起看，她反而没那么慌。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "顾问调整完以后，她按" + ctx.ServiceCue + "又补了一张。前后差别不用别人解释。"
		},
		func(ctx NarrativeTemplateContext) string {
			return ctx.ProofCue + "留下来以后，店拍和自拍终于能一起看，不会只记得哪张最漂亮。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "她前面还在问" + ctx.ConcernCue + "，走动视频拍完以后，自己先说这件好像轻一点。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "手机位置换了两次，最后按" + ctx.ServiceCue + "拍出来的那张最普通，却最能说明问题。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "看到" + ctx.ProofCue + "时，她才发现刚才站得太僵，于是又放松肩膀拍了一张。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "关于" + ctx.ConcernCue + "的判断，不是在镜子前立刻有答案，是回到相册里慢慢变清楚。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "她没有忙着修图，先按" + ctx.ServiceCue + "把该留的角度补齐。这个顺序挺重要。"
		},
		func(ctx NarrativeTemplateContext) string {
			return ctx.ProofCue + "不一定最好看，但后来回家复盘，她反而最常打开这一张。"
		},
	},
	"prep": {
		func(ctx NarrativeTemplateContext) string {
			return "后来她把" + ctx.ProofCue + "也写进备忘录，第二天试纱时少问了很多重复问题。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "原本担心" + ctx.ConcernCue + "，但东西收好以后，那种慌张少了一半。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "她没有把清单做得很复杂，只提醒自己" + ctx.ServiceCue + "。到店后反而更能听进去顾问的话。"
		},
		func(ctx NarrativeTemplateContext) string {
			return ctx.ProofCue + "留下来以后，回家复盘不再只靠记忆。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "关于" + ctx.ConcernCue + "，提前想一遍，不是制造焦虑，是给现场留一点余地。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "试纱当天她真的按" + ctx.ServiceCue + "做了，最直接的变化是没那么容易被第一件带跑。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "看到" + ctx.ProofCue + "那一页时，顾问也更快知道她在意什么。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "她以前觉得" + ctx.ConcernCue + "很丢脸，写下来以后，反而能正常说出口。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "准备到最后，最有用的不是塞满包，而是记得" + ctx.ServiceCue + "。"
		},
		func(ctx NarrativeTemplateContext) string {
			return ctx.ProofCue + "不是为了显得专业，是为了试完以后还能想起当时的判断。"
		},
	},
	"companion": {
		func(ctx NarrativeTemplateContext) string {
			return "后来看到" + ctx.ProofCue + "，她自己也安静了一下，不再急着问我们哪件更好。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "前面她总问" + ctx.ConcernCue + "，但这件走出来以后，先看镜子的人变成了她自己。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "朋友没有急着夸，只是按" + ctx.ServiceCue + "补了一段视频，意见就具体多了。"
		},
		func(ctx NarrativeTemplateContext) string {
			return ctx.ProofCue + "留下来以后，妈妈的那句“这件舒服吗”终于有了画面。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "关于" + ctx.ConcernCue + "，旁边人看得出来她什么时候是真的放松，不用说太满。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "伴侣后来也学会了" + ctx.ServiceCue + "，虽然动作有点笨，但她笑了。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "比起大家一起喊好看，" + ctx.ProofCue + "更能让她回家后继续判断。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "她前面一直绕着" + ctx.ConcernCue + "打转，朋友把视频递过去以后，她反而没再追问。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "陪试到后面，最有用的事就是" + ctx.ServiceCue + "，少一点情绪，多一点证据。"
		},
		func(ctx NarrativeTemplateContext) string {
			return ctx.ProofCue + "放进相册以后，那天的变化就不只存在大家的记忆里。"
		},
	},
	"brand": {
		func(ctx NarrativeTemplateContext) string {
			return "后来我们把" + ctx.ProofCue + "放到第二张，主图反而不用说太多。看的人会自己接上。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "原本担心" + ctx.ConcernCue + "，所以这组没有只留远景。细节补上以后，发布才站得住。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "拍完第一轮，团队又按" + ctx.ServiceCue + "补了一组。不是为了更满，是为了更清楚。"
		},
		func(ctx NarrativeTemplateContext) string {
			return ctx.ProofCue + "出现以后，这件的适配人群就好讲了，不必硬写成所有人都适合。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "如果" + ctx.ConcernCue + "没有被回答，再温柔的标题也会显得虚。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "这组最后保留了" + ctx.ServiceCue + "，因为它能让新品从“好看”落到“我能不能穿”。"
		},
		func(ctx NarrativeTemplateContext) string {
			return ctx.ProofCue + "让侧面和背影有了位置，不再只是封面图的陪衬。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "关于" + ctx.ConcernCue + "，最好的回答不是形容词，是一张不修得太狠的近景。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "发布前删掉了几句过满的卖点，改成" + ctx.ServiceCue + "。读起来轻多了。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "等" + ctx.ProofCue + "排进去以后，这组图才像一个系列，而不是几张漂亮婚纱。"
		},
	},
	"store": {
		func(ctx NarrativeTemplateContext) string {
			return "后来客人看到" + ctx.ProofCue + "，才开始把自己的顾虑说得更具体。顾问也就能接住。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "她一开始担心" + ctx.ConcernCue + "，试完第一件后发现没人催，肩膀才慢慢放下来。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "顾问按" + ctx.ServiceCue + "做完以后，没有马上推进下一件，只是等她自己看镜子。"
		},
		func(ctx NarrativeTemplateContext) string {
			return ctx.ProofCue + "被拍下来以后，这条门店日常就不只是在展示空间。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "关于" + ctx.ConcernCue + "，一张试纱间照片不够，流程里的停顿也要看见。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "那天最让人放松的不是夸奖，是" + ctx.ServiceCue + "这一步做得很自然。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "看到" + ctx.ProofCue + "，预约前的人至少能知道进店后不是只站着被评价。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "她把" + ctx.ConcernCue + "问出口以后，顾问没有打断。这个小反应，我会留下。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "服务感不是喊出来的，" + ctx.ServiceCue + "这类动作拍到一点就够。"
		},
		func(ctx NarrativeTemplateContext) string {
			return ctx.ProofCue + "放进组图里，店铺的信任感就不靠装修撑着了。"
		},
	},
	"dress": {
		func(ctx NarrativeTemplateContext) string {
			return "后来她没有换姿势，只是自然走到门口，" + ctx.ProofCue + "在这个动作里比摆拍更清楚。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "拍到一半她停下来整理了一下包带，再抬头时整个人松了一点。" + ctx.ServiceCue + "，也不需要写得太复杂。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "原本担心" + ctx.ConcernCue + "，但坐下又站起来以后，她没有再伸手去整理。"
		},
		func(ctx NarrativeTemplateContext) string {
			return ctx.ProofCue + "留下来以后，这条裙子就不只是好看，而是知道能穿去哪里。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "她没有马上下单式地夸自己，只是换了鞋再看一眼。" + ctx.ServiceCue + "之后，她说今天这样就能出门。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "走到楼下时她又看了一眼玻璃反光，" + ctx.ConcernCue + "没有出现，表情就自然很多。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "比起正面照，" + ctx.ProofCue + "更像真正会被保存的那张，因为动作没有被设计过。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "朋友在旁边提醒她多走两步，她试了一下，发现裙摆没有卡住脚步。" + ctx.ServiceCue + "这类细节，现场看更清楚。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "她之前一直问" + ctx.ConcernCue + "，后来换了包再看，反而没有那么纠结了。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "等到" + ctx.ProofCue + "出现时，这条裙子的日常感才落下来，不像只为一张照片存在。"
		},
	},
}

// humanClosings 翻译自 TS :1922-2007
var humanClosings = map[string][]NarrativeTemplate{
	"bridal": {
		func(ctx NarrativeTemplateContext) string {
			return "所以我会停在这里。能记住" + ctx.TakeawayCue + "，就够一个人回家慢慢想了。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "给" + ctx.AudienceCue + "看的记录，不一定要替她做决定，至少要让她记得自己在镜子前的那个反应。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "最后她也没有当场说死，只是把这组照片存下来。" + ctx.TakeawayCue + "，有时候就是从这种小停顿开始的。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "我更想保留这种不着急的试纱记录，" + ctx.AudienceCue + "看完会知道，适合不是被夸出来的。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "如果只剩一句漂亮，回家很快就忘了；但" + ctx.TakeawayCue + "，以后再翻相册也能看懂。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "这不是热闹的客照，但对" + ctx.AudienceCue + "来说，真实身体感受比热闹更有用。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "到这里就够了，不需要把情绪推到很高，" + ctx.TakeawayCue + "才是这组图该留下的原因。"
		},
		func(ctx NarrativeTemplateContext) string {
			return ctx.AudienceCue + "其实很需要这种慢一点的记录，不催她喜欢，也不催她立刻确定。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "最后那张手机照有点普通，但我会留下。因为" + ctx.TakeawayCue + "，往往就藏在普通照片里。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "如果" + ctx.AudienceCue + "试纱时能少一点慌，多看一眼自己的身体状态，就够了。"
		},
	},
	"phone": {
		func(ctx NarrativeTemplateContext) string {
			return "所以这组自拍不用修得太漂亮。能留下" + ctx.TakeawayCue + "，就已经够回家看了。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "给" + ctx.AudienceCue + "的小提醒：拍给自己复盘的照片，普通一点没关系。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "最后我会留那张没开滤镜的，因为" + ctx.TakeawayCue + "，比一张很好看的店拍更实在。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "试纱时别只等别人发图，自己的手机也要有几张能看懂的。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "这组到这里就够了。" + ctx.TakeawayCue + "，回家再看时会感谢自己多拍了一张。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "如果" + ctx.AudienceCue + "看完记得关掉广角、别挡腰线，就很有用了。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "试纱那天情绪很容易满，" + ctx.TakeawayCue + "能把人稍微拉回来一点。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "别嫌手机照太普通。对" + ctx.AudienceCue + "来说，普通照片常常最诚实。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "收尾不讲大道理，留好正面、侧面和走动。" + ctx.TakeawayCue + "就藏在这里。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "下次" + ctx.AudienceCue + "进试纱间，先拍一张正常镜头的全身，再慢慢选。"
		},
	},
	"prep": {
		func(ctx NarrativeTemplateContext) string {
			return "准备做到这里就够了。" + ctx.TakeawayCue + "，比临时抱佛脚有用。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "给" + ctx.AudienceCue + "一句很小的提醒：别饿着去，也别把一天排太满。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "如果这张清单能留下" + ctx.TakeawayCue + "，试纱当天就会轻一点。"
		},
		func(ctx NarrativeTemplateContext) string {
			return ctx.AudienceCue + "不用带着完美状态出门，带着问题就可以。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "最后把鞋和手机充电器放进包里。" + ctx.TakeawayCue + "，很多时候就靠这些小事。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "下次" + ctx.AudienceCue + "预约试纱前，先写三句话：场地、预算、最担心哪里。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "这不是让人更紧张的攻略。" + ctx.TakeawayCue + "，才是准备的目的。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "如果" + ctx.AudienceCue + "到店后能慢慢说出顾虑，这份准备就够了。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "试纱准备不用做得很漂亮。能带走" + ctx.TakeawayCue + "，就已经很好。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "收尾就到这里。" + ctx.AudienceCue + "记得留点体力给真正上身的那一刻。"
		},
	},
	"companion": {
		func(ctx NarrativeTemplateContext) string {
			return "陪试纱的人不用负责拍板，能把真实反应和走动视频留下来就已经很帮忙。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "给" + ctx.AudienceCue + "一句提醒：先听她怎么说，再说自己看见了什么。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "最后我会留那段走动视频。" + ctx.TakeawayCue + "，回家看时比口头意见稳。"
		},
		func(ctx NarrativeTemplateContext) string {
			return ctx.AudienceCue + "别急着把气氛推高，安静陪她看完也很好。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "这组陪试记录不用写得很满。" + ctx.TakeawayCue + "，就藏在旁边人的小动作里。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "如果" + ctx.AudienceCue + "能少说“都好看”，多说一个具体差别，她会轻松很多。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "几个人一起确认的过程很小，但" + ctx.TakeawayCue + "，以后翻相册会想起来。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "陪" + ctx.AudienceCue + "试纱，不是替她喜欢，是帮她看见自己有没有放松。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "收尾就停在这里。" + ctx.TakeawayCue + "，比一场夸张见证更像真实试纱。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "下次" + ctx.AudienceCue + "陪试，记得拍侧面和背影，也记得问她自己舒服吗。"
		},
	},
	"brand": {
		func(ctx NarrativeTemplateContext) string {
			return "这组发布我会写到这里。" + ctx.TakeawayCue + "，比把每件都夸满更有分寸。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "给" + ctx.AudienceCue + "看的新品图，最好能帮她少翻几遍，也少猜一点。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "如果看完能记住" + ctx.TakeawayCue + "，这件婚纱就不用靠口号撑着。"
		},
		func(ctx NarrativeTemplateContext) string {
			return ctx.AudienceCue + "不缺漂亮图，缺的是能判断自己适不适合的那几张。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "最后一张留给面料近景。" + ctx.TakeawayCue + "，往往就是从近处看出来的。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "新品发布不用替" + ctx.AudienceCue + "下结论，把该看的地方拍清楚就够。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "这组不急着喊命定。" + ctx.TakeawayCue + "，比热闹的形容词更耐看。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "如果" + ctx.AudienceCue + "看完能排除一件不适合的，也算这组图有用。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "发布到最后，还是回到衣服本身。" + ctx.TakeawayCue + "，别让氛围盖过去。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "我更愿意让" + ctx.AudienceCue + "慢一点看完，而不是被第一张图推着立刻喜欢。"
		},
	},
	"store": {
		func(ctx NarrativeTemplateContext) string {
			return "所以门店日常不用拍得很吵。" + ctx.TakeawayCue + "，比一句欢迎预约实在。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "给" + ctx.AudienceCue + "看的东西，先让她知道进店后会被怎么对待。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "这组图到这里就够了。" + ctx.TakeawayCue + "，藏在顾问的小动作里。"
		},
		func(ctx NarrativeTemplateContext) string {
			return ctx.AudienceCue + "预约前会紧张，那就把流程拍清楚一点，别只拍漂亮角落。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "最后我会留一张记录表和面料小样。" + ctx.TakeawayCue + "，比空间照更有用。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "如果" + ctx.AudienceCue + "看完愿意把顾虑说出来，这条门店记录就没有白发。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "店铺的可信度不是靠热闹堆出来的。" + ctx.TakeawayCue + "，慢慢看得见。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "给还没到店的" + ctx.AudienceCue + "留一点真实流程，比只发客片更安心。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "这组不需要夸自己专业。" + ctx.TakeawayCue + "，画面里已经有答案。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "下次" + ctx.AudienceCue + "翻到这类门店笔记，先看服务过程，再看装修。"
		},
	},
	"dress": {
		func(ctx NarrativeTemplateContext) string {
			return "这条记录不用写成种草，" + ctx.TakeawayCue + "，比把话说得漂亮更重要。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "给" + ctx.AudienceCue + "看的裙装记录，最好像出门前随手拍下来的备注，真实一点就够了。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "最后她还是穿这条出了门。没有特别隆重，但" + ctx.TakeawayCue + "，这就是日常裙子的意义。"
		},
		func(ctx NarrativeTemplateContext) string {
			return ctx.AudienceCue + "不会只因为一句高级就保存，她们更想知道这条裙子能不能进入自己的生活。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "如果看完只记得氛围，其实不够；能记住" + ctx.TakeawayCue + "，才有用。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "这组图不需要太满，留一点真实动作，" + ctx.AudienceCue + "反而更容易代入。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "收尾就写到这里，不拔高，也不催人买。" + ctx.TakeawayCue + "，比口号更耐看。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "我会把它发得像一条普通日程，给" + ctx.AudienceCue + "一个可以照着判断的画面。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "有些裙子不是第一眼赢，是穿过一天以后还舒服。" + ctx.TakeawayCue + "，这点就够具体。"
		},
		func(ctx NarrativeTemplateContext) string {
			return "如果" + ctx.AudienceCue + "看完能想起自己衣柜里缺的那一种状态，就没有写空。"
		},
	},
}
