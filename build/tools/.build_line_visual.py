from pathlib import Path
import json

POINTS = {
 'screen.capture': {'label':'截屏','icon':'▣','color':'#10b981'},
 'ocr.read': {'label':'OCR','icon':'◎','color':'#f59e0b'},
 'translate.text': {'label':'翻译','icon':'文','color':'#8b5cf6'},
 'render.overlay': {'label':'浮层','icon':'◫','color':'#06b6d4'},
 'file.watch': {'label':'文件监听','icon':'◉','color':'#3b82f6'},
 'extract.invoice': {'label':'发票提取','icon':'⌁','color':'#ec4899'},
 'validate.invoice': {'label':'发票校验','icon':'✓','color':'#22c55e'},
 'file.move': {'label':'移动文件','icon':'↦','color':'#f97316'},
 'notify.tray': {'label':'托盘通知','icon':'◔','color':'#94a3b8'},
 'input.clipboard': {'label':'读剪贴板','icon':'▤','color':'#3b82f6'},
 'text.template': {'label':'文本模板','icon':'{}','color':'#a78bfa'},
 'file.write': {'label':'写文件','icon':'✎','color':'#f97316'},
 'notify.toast': {'label':'Toast','icon':'◔','color':'#94a3b8'},
}
PINS = {
 'cap.region': {'pointClass':'screen.capture','rev':2,'params':{'x':0,'y':0,'width':800,'height':600}},
 'ocr.zh.screen': {'pointClass':'ocr.read','rev':3,'params':{'lang':'zh','layout':True}},
 'ocr.ja.screen': {'pointClass':'ocr.read','rev':1,'params':{'lang':'ja','layout':True}},
 'trans.en2zh': {'pointClass':'translate.text','rev':1,'params':{'from':'en','to':'zh'}},
 'trans.ja2zh': {'pointClass':'translate.text','rev':2,'params':{'from':'ja','to':'zh'}},
 'overlay.toast': {'pointClass':'render.overlay','rev':2,'params':{'position':'bottom','duration':2500}},
 'watch.inbox': {'pointClass':'file.watch','rev':1,'params':{'dir':'C:\\inbox','events':['create']}},
 'ocr.zh.invoice': {'pointClass':'ocr.read','rev':4,'params':{'lang':'zh','layout':True}},
 'ocr.en.invoice': {'pointClass':'ocr.read','rev':2,'params':{'lang':'en','layout':False}},
 'extract.vendor': {'pointClass':'extract.invoice','rev':2,'params':{'rules':'company','fields':['vendor','amount','date']}},
 'extract.personal': {'pointClass':'extract.invoice','rev':1,'params':{'rules':'personal','fields':['amount','date']}},
 'validate.amount': {'pointClass':'validate.invoice','rev':1,'params':{'required':['vendor','amount'],'maxAmount':50000}},
 'validate.personal': {'pointClass':'validate.invoice','rev':1,'params':{'required':['amount'],'maxAmount':5000}},
 'move.archive': {'pointClass':'file.move','rev':2,'params':{'to':'C:\\archive\\company','overwrite':False}},
 'notify.unmatched': {'pointClass':'notify.tray','rev':1,'params':{'title':'未匹配发票','level':'warning'}},
 'clip.text': {'pointClass':'input.clipboard','rev':1,'params':{'format':'text'}},
 'template.markdown': {'pointClass':'text.template','rev':2,'params':{'tpl':'# {text}'}},
 'write.append': {'pointClass':'file.write','rev':3,'params':{'append':True,'createDirs':True}},
 'write.daily': {'pointClass':'file.write','rev':1,'params':{'append':False,'createDirs':True}},
 'notify.toast': {'pointClass':'notify.toast','rev':1,'params':{'title':'已保存','level':'success'}},
}

def node(id, x, y, w, label, point_class, point_instance, abstract, inputs, outputs, h=82, kind='point', gate=None):
    return {'id':id,'x':x,'y':y,'w':w,'h':h,'label':label,'kind':kind,'gate':gate,
            'pointClass':point_class,'pointInstance':point_instance,'abstract':abstract,
            'inputs':inputs,'outputs':outputs}

flows = [
 {
  'id':'flow.screenshot-translate','name':'截图翻译','family':'采集 → 转换 → 输出','version':'1.2.0',
  'desc':'截屏 → OCR → 翻译 → 浮层；同一个类，不同语言/开关就是不同实例。',
  'w':1000,'h':320,
  'params':[
    {'key':'sourceLang','label':'源语言','type':'enum','options':['en','ja','zh'],'default':'en'},
    {'key':'targetLang','label':'目标语言','type':'enum','options':['zh','en'],'default':'zh'},
    {'key':'overlay','label':'显示浮层','type':'bool','default':True},
  ],
  'nodes':[
    node('capture',30,110,150,'截屏','screen.capture','cap.region',['region'],[],[{'name':'image','type':'Image'}]),
    node('ocr',280,110,150,'OCR','ocr.read','ocr.zh.screen',['$sourceLang'],[{'name':'image','type':'Image'}],[{'name':'text','type':'Text'}]),
    node('translate',530,110,150,'翻译','translate.text','trans.en2zh',['$sourceLang → $targetLang'],[{'name':'text','type':'Text'}],[{'name':'text','type':'Text'}]),
    node('overlay',780,110,150,'浮层','render.overlay','overlay.toast',['if $overlay'],[{'name':'text','type':'Text'}],[]),
  ],
  'edges':[
    {'from':'capture','to':'ocr','label':'Image'},
    {'from':'ocr','to':'translate','label':'Text'},
    {'from':'translate','to':'overlay','label':'Text'},
  ],
  'code':[
    {'text':'flow screenshotTranslate(sourceLang, targetLang, overlay) {','node':None},
    {'text':'  shot       = screen.capture(region)','node':'capture'},
    {'text':'  text       = ocr.read(shot, lang = sourceLang)','node':'ocr'},
    {'text':'  translated = translate.text(text, from = sourceLang, to = targetLang)','node':'translate'},
    {'text':'  if (overlay) render.overlay(translated)','node':'overlay'},
    {'text':'}','node':None},
  ],
  'instances':[
    {'id':'inst.en-zh','name':'英 → 中','rev':4,'args':{'sourceLang':'en','targetLang':'zh','overlay':True},
     'pins':{'capture':'cap.region','ocr':'ocr.zh.screen','translate':'trans.en2zh','overlay':'overlay.toast'},
     'trace':{'capture':{'ms':120,'status':'ok'},'ocr':{'ms':480,'status':'ok'},'translate':{'ms':760,'status':'ok'},'overlay':{'ms':90,'status':'ok'}}},
    {'id':'inst.ja-zh','name':'日 → 中','rev':2,'args':{'sourceLang':'ja','targetLang':'zh','overlay':False},
     'pins':{'capture':'cap.region','ocr':'ocr.ja.screen','translate':'trans.ja2zh','overlay':'overlay.toast'},
     'trace':{'capture':{'ms':115,'status':'ok'},'ocr':{'ms':510,'status':'ok'},'translate':{'ms':820,'status':'ok'},'overlay':{'ms':0,'status':'skipped'}}},
  ],
 },
 {
  'id':'flow.invoice-archive','name':'发票归档','family':'批量 / 文件处理','version':'2.0.0',
  'desc':'监听目录 → 遍历文件 → OCR → 提取 → 校验 → 分支移动/通知；规则不同是实例，图相同。',
  'w':1160,'h':430,
  'params':[
    {'key':'watchDir','label':'监考目录','type':'folder','default':'C:\\inbox'},
    {'key':'vendorRules','label':'供应商规则','type':'enum','options':['company','personal'],'default':'company'},
    {'key':'archiveDir','label':'归档目录','type':'folder','default':'C:\\archive'},
    {'key':'ocrLang','label':'OCR 语言','type':'enum','options':['zh','en'],'default':'zh'},
  ],
  'nodes':[
    node('watch',20,175,140,'监听目录','file.watch','watch.inbox',['$watchDir'],[],[{'name':'files','type':'File[]'}]),
    node('foreach',180,175,120,'遍历文件',None,None,['file in files'],[{'name':'files','type':'File[]'}],[{'name':'file','type':'File'}],kind='gate',gate='foreach'),
    node('ocr',330,175,140,'OCR','ocr.read','ocr.zh.invoice',['$ocrLang'],[{'name':'file','type':'File'}],[{'name':'text','type':'Text'}]),
    node('extract',490,175,140,'提取发票','extract.invoice','extract.vendor',['$vendorRules'],[{'name':'text','type':'Text'}],[{'name':'invoice','type':'Invoice'}]),
    node('validate',650,175,140,'校验','validate.invoice','validate.amount',['rules = $vendorRules'],[{'name':'invoice','type':'Invoice'}],[{'name':'ok','type':'Bool'}]),
    node('if',810,175,120,'if 命中',None,None,['ok?'],[{'name':'invoice','type':'Invoice'}],[{'name':'ok','type':'Bool'},{'name':'else','type':'Bool'}],kind='gate',gate='if'),
    node('move',960,60,140,'移动归档','file.move','move.archive',['to = $archiveDir'],[{'name':'file','type':'File'}],[]),
    node('notify',960,290,140,'未匹配通知','notify.tray','notify.unmatched',['$(else)'],[{'name':'file','type':'File'}],[]),
  ],
  'edges':[
    {'from':'watch','to':'foreach','label':'File[]'},
    {'from':'foreach','to':'ocr','label':'File'},
    {'from':'ocr','to':'extract','label':'Text'},
    {'from':'extract','to':'validate','label':'Invoice'},
    {'from':'validate','to':'if','label':'Bool'},
    {'from':'if','to':'move','label':'true','tone':'ok'},
    {'from':'if','to':'notify','label':'false','tone':'warn'},
  ],
  'code':[
    {'text':'flow invoiceArchive(watchDir, vendorRules, archiveDir, ocrLang) {','node':None},
    {'text':'  files = file.watch(watchDir)','node':'watch'},
    {'text':'  foreach (file in files) {','node':'foreach'},
    {'text':'    text    = ocr.read(file, lang = ocrLang)','node':'ocr'},
    {'text':'    invoice = extract.invoice(text, rules = vendorRules)','node':'extract'},
    {'text':'    ok      = validate.invoice(invoice, rules = vendorRules)','node':'validate'},
    {'text':'    if (ok) file.move(file, archiveDir)','node':'if'},
    {'text':'    else    notify.unmatched(file)','node':'notify'},
    {'text':'  }','node':None},
    {'text':'}','node':None},
  ],
  'instances':[
    {'id':'inst.company','name':'公司发票','rev':6,'args':{'watchDir':'C:\\inbox','vendorRules':'company','archiveDir':'C:\\archive\\company','ocrLang':'zh'},
     'pins':{'watch':'watch.inbox','ocr':'ocr.zh.invoice','extract':'extract.vendor','validate':'validate.amount','move':'move.archive','notify':'notify.unmatched'},
     'trace':{'watch':{'ms':80,'status':'ok'},'foreach':{'ms':20,'status':'ok'},'ocr':{'ms':520,'status':'ok'},'extract':{'ms':40,'status':'ok'},'validate':{'ms':10,'status':'ok'},'if':{'ms':1,'status':'ok'},'move':{'ms':60,'status':'ok'},'notify':{'ms':0,'status':'skipped'}}},
    {'id':'inst.personal','name':'个人发票','rev':2,'args':{'watchDir':'C:\\inbox','vendorRules':'personal','archiveDir':'C:\\archive\\personal','ocrLang':'en'},
     'pins':{'watch':'watch.inbox','ocr':'ocr.en.invoice','extract':'extract.personal','validate':'validate.personal','move':'move.archive','notify':'notify.unmatched'},
     'trace':{'watch':{'ms':75,'status':'ok'},'foreach':{'ms':18,'status':'ok'},'ocr':{'ms':430,'status':'ok'},'extract':{'ms':35,'status':'ok'},'validate':{'ms':9,'status':'ok'},'if':{'ms':1,'status':'ok'},'move':{'ms':0,'status':'skipped'},'notify':{'ms':50,'status':'ok'}}},
  ],
 },
 {
  'id':'flow.clipboard-to-file','name':'剪贴板存文件','family':'输入 → 处理 → 保存','version':'1.0.0',
  'desc':'读剪贴板 → 模板 → 写文件 → 通知；路径/追加开关不同就是不同实例。',
  'w':930,'h':300,
  'params':[
    {'key':'path','label':'目标文件','type':'file','default':'~/inbox.md'},
    {'key':'append','label':'追加写入','type':'bool','default':True},
  ],
  'nodes':[
    node('clip',30,110,150,'读剪贴板','input.clipboard','clip.text',['format = text'],[],[{'name':'text','type':'Text'}]),
    node('template',270,110,150,'模板','text.template','template.markdown',['tpl = markdown'],[{'name':'text','type':'Text'}],[{'name':'body','type':'Text'}]),
    node('write',510,110,150,'写文件','file.write','write.append',['$path, append=$append'],[{'name':'body','type':'Text'}],[]),
    node('notify',750,110,140,'通知','notify.toast','notify.toast',['success'],[],[]),
  ],
  'edges':[
    {'from':'clip','to':'template','label':'Text'},
    {'from':'template','to':'write','label':'Text'},
    {'from':'write','to':'notify','label':'done'},
  ],
  'code':[
    {'text':'flow clipboardToFile(path, append) {','node':None},
    {'text':'  text = input.clipboard.read(format = text)','node':'clip'},
    {'text':'  body = text.template(text, tpl = markdown)','node':'template'},
    {'text':'  file.write(path, body, append = append)','node':'write'},
    {'text':'  notify.toast("saved")','node':'notify'},
    {'text':'}','node':None},
  ],
  'instances':[
    {'id':'inst.inbox','name':'收件箱','rev':3,'args':{'path':'~/inbox.md','append':True},
     'pins':{'clip':'clip.text','template':'template.markdown','write':'write.append','notify':'notify.toast'},
     'trace':{'clip':{'ms':20,'status':'ok'},'template':{'ms':5,'status':'ok'},'write':{'ms':15,'status':'ok'},'notify':{'ms':10,'status':'ok'}}},
    {'id':'inst.daily','name':'每日笔记','rev':1,'args':{'path':'~/daily/2026-11-23.md','append':False},
     'pins':{'clip':'clip.text','template':'template.markdown','write':'write.daily','notify':'notify.toast'},
     'trace':{'clip':{'ms':18,'status':'ok'},'template':{'ms':4,'status':'ok'},'write':{'ms':22,'status':'ok'},'notify':{'ms':8,'status':'ok'}}},
  ],
 },
]
data = {'points':POINTS,'pins':PINS,'flows':flows}
Path('.line-visual-data.json').write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
print('flows',len(flows),'nodes',sum(len(f['nodes']) for f in flows),'instances',sum(len(f['instances']) for f in flows))
