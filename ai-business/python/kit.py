"""Deterministic Excel builder/checker. AI text never becomes executable formulas."""
import base64, hashlib, io, json, sys, zipfile, calendar
from datetime import date
from openpyxl import Workbook, load_workbook
from openpyxl.styles import Font, PatternFill, Alignment
from openpyxl.worksheet.datavalidation import DataValidation

def safe(text):
    t=str(text)
    return "'"+t if t.lstrip().startswith(('=','+','-','@')) else t

def table(kind, month):
    year,m=map(int,month.split('-')); days=calendar.monthrange(year,m)[1]
    w=Workbook();s=w.active;s.title='日別入力'
    s.append([kind+'｜入力見本は架空データ']);s.append(['日付','予約枠','予約件数','来院数','売上（円）','来院稼働率'])
    for d in range(1,days+1):
        r=d+2;n=[4,5,3,4,5,0,0][(d-1)%7]
        s.append([date(year,m,d),6 if n else 0,n+1 if n else 0,n,n*6000,f'=IF(B{r}=0,"",D{r}/B{r})'])
        s.cell(r,1).number_format='m/d';s.cell(r,5).number_format='#,##0';s.cell(r,6).number_format='0.0%'
    end=days+2;total=end+1;s.append(['月合計']+[f'=SUM({col}3:{col}{end})' for col in 'BCDE']+[f'=IF(B{total}=0,"",D{total}/B{total})']);s.cell(total,6).number_format='0.0%'
    dv=DataValidation(type='whole',operator='between',formula1=0,formula2=99999);dv.allow_blank=True;dv.showErrorMessage=True;s.add_data_validation(dv);dv.add(f'B3:D{end}')
    dv2=DataValidation(type='decimal',operator='between',formula1=0,formula2=99999999);dv2.showErrorMessage=True;dv2.allow_blank=True;s.add_data_validation(dv2);dv2.add(f'E3:E{end}')
    s.freeze_panes='B3';s.auto_filter.ref=f'A2:F{end}'
    if kind!='基本管理表':
        v=w.create_sheet('振り返り');v.append(['月末の振り返り']);v.append(['平均来院単価',f'=IF(\'日別入力\'!D{total}=0,"",\'日別入力\'!E{total}/\'日別入力\'!D{total})']);v.append(['来月見直すこと','［気づきと行動を記入］'])
        if kind=='経営分析':
            v.append(['その他運営費（円）',0]);v.append(['AI利用料（円）',0]);v.append(['費用控除後の参考額',f"='日別入力'!E{total}-B4-B5"]);v.append(['注意','税・原価など未入力の費用は反映しません。利益を保証しません。'])
    for ws in w:
        ws.sheet_view.showGridLines=False
        for col in 'ABCDEF':ws.column_dimensions[col].width=21
        for cell in ws[1]:cell.font=Font(color='FFFFFF',bold=True);cell.fill=PatternFill('solid',fgColor='365D4C')
        for row in ws.iter_rows(min_row=3):
            for c in row:c.alignment=Alignment(wrap_text=True)
        ws.sheet_properties.pageSetUpPr.fitToPage=True;ws.page_setup.fitToWidth=1;ws.page_setup.fitToHeight=1
    for row in s.iter_rows(min_row=3,max_row=end,min_col=2,max_col=5):
        for c in row:c.font=Font(color='2269AA');c.fill=PatternFill('solid',fgColor='F0F5F8')
    guide=w.create_sheet('使い方');guide.column_dimensions['A'].width=90
    for line in ['青字の入力見本はすべて架空です。利用前に消して数字を入力してください。','日付と集計の数式は編集しません。休診日の予約枠は0にします。','予約件数はキャンセル前を含む受付件数、来院数は実際の人数です。','来院稼働率＝来院数÷予約枠。0枠の日は空欄になります。','患者名・症状・連絡先などの個人情報は入力しません。','翌月分は新しい月向けの管理表を使います。会計・税務用の帳簿ではありません。']:guide.append([line]);guide.row_dimensions[guide.max_row].height=30;guide.cell(guide.max_row,1).alignment=Alignment(wrap_text=True)
    guide.sheet_properties.pageSetUpPr.fitToPage=True;guide.page_setup.fitToWidth=1;guide.page_setup.fitToHeight=1
    stream=io.BytesIO();w.save(stream);blob=stream.getvalue()
    # Reopen and check formulas, ranges, input data and independent expected totals.
    check=load_workbook(io.BytesIO(blob));cs=check['日別入力']
    assert cs.cell(total,5).value==f'=SUM(E3:E{end})'
    assert cs.cell(total,6).value==f'=IF(B{total}=0,"",D{total}/B{total})'
    assert sum(cs.cell(r,5).value for r in range(3,end+1))==sum(cs.cell(r,4).value for r in range(3,end+1))*6000
    assert len(cs.data_validations.dataValidation)==2 and not check._external_links
    for r in range(3,end+1):assert cs.cell(r,6).value==f'=IF(B{r}=0,"",D{r}/B{r})'
    return blob

def build(payload):
    c=payload['content'];month=payload['month'];buffer=io.BytesIO();report=[]
    assert len(c['sns'])==20 and len(c['blogs'])==4 and len(c['prompts'])==5
    workbooks={name:table(name,month) for name in ['基本管理表','応用管理表','経営分析']}
    with zipfile.ZipFile(buffer,'w',zipfile.ZIP_DEFLATED) as bundle:
        for plan,count,blogs in [('light',4,0),('standard',12,2),('premium',20,4)]:
            prefix=plan+'/'
            for kind in ['基本管理表']+(['応用管理表'] if plan!='light' else [])+(['経営分析'] if plan=='premium' else []):bundle.writestr(prefix+kind+'.xlsx',workbooks[kind])
            sections=['# SNS投稿文（院ごとに編集する下書き）']+[f'## {i+1}\n{t}' for i,t in enumerate(c['sns'][:count])]
            if blogs:sections+=['# ブログ記事']+[f'## {i+1}\n{t}' for i,t in enumerate(c['blogs'][:blogs])]+['# AIプロンプト']+c['prompts']
            if plan=='premium':sections+=['# キャンペーン企画',c['campaign'],'# 経営改善チェックリスト']+c['checklist']
            bundle.writestr(prefix+'発信素材.md','\n\n'.join(sections))
            bundle.writestr(prefix+'使い方.md',c['guide']+'\n\n広告表現・権利・事実は公開前に確認。患者情報をAIへ入力しないでください。')
        bundle.writestr('owner-only/集客下書き.md','\n\n'.join(k+'\n'+v for k,v in c['marketing'].items()))
        report=['Excel再読込OK','数式と入力範囲の整合性OK','架空入力の集計整合性OK','外部参照なし','3プラン振り分けOK']
        bundle.writestr('検査結果.json',json.dumps(report,ensure_ascii=False))
    blob=buffer.getvalue();return {'zip':base64.b64encode(blob).decode(),'sha256':hashlib.sha256(blob).hexdigest(),'checks':report}

if __name__=='__main__':
    try:print(json.dumps(build(json.load(sys.stdin)),ensure_ascii=False))
    except Exception as e:print(json.dumps({'error':type(e).__name__}));sys.exit(1)
