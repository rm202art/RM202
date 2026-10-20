"""Develop the 73 Top Tier photos for the RM202 site: orientation-correct, 1600px + 640px JPGs, EXIF stripped,
blurs every region in blur_regions.json (model faces, sensitive parts, buttocks) and people.json (faces of attendees without posting consent). Writes photos.json."""
import csv,os,sys,json,subprocess,tempfile
from concurrent.futures import ThreadPoolExecutor
from PIL import Image,ImageFilter,ImageDraw
R='/Volumes/TRANSCEND/ROOM 202'; TT=R+'/Room 202 Top Tier'; HERE=os.path.dirname(os.path.abspath(__file__))
OUT=sys.argv[1]; os.makedirs(OUT+'/full',exist_ok=True); os.makedirs(OUT+'/thumb',exist_ok=True)
REG=json.load(open(HERE+'/blur_regions.json')); PEOPLE=json.load(open(HERE+'/people.json')); rows=list(csv.DictReader(open(TT+'/top_tier.csv')))
ori={}
o=subprocess.run([R+'/scripts/exifdt',*[f"{TT}/{r['section']}/{r['file']}" for r in rows]],capture_output=True,text=True).stdout
for l in o.splitlines(): p,*_,v=l.split('\t'); ori[os.path.basename(p)]=int(v or 1)
ROT={3:Image.ROTATE_180,6:Image.ROTATE_270,8:Image.ROTATE_90}
def blur(im,boxes):
    W,H=im.size
    for x0,y0,x1,y1 in boxes:
        b=(int(W*x0/100),int(H*y0/100),int(W*x1/100),int(H*y1/100)); bw,bh=b[2]-b[0],b[3]-b[1]
        # pixelate then soften: unreadable but not a black bar
        reg=im.crop(b); s=max(bw,bh)//10 or 1
        reg=reg.resize((max(1,bw//s),max(1,bh//s)),Image.BILINEAR).resize((bw,bh),Image.NEAREST).filter(ImageFilter.GaussianBlur(s*0.9))
        m=Image.new('L',(bw,bh),0); ImageDraw.Draw(m).ellipse((0,0,bw-1,bh-1),fill=255); m=m.filter(ImageFilter.GaussianBlur(min(bw,bh)*0.06))
        im.paste(reg,b[:2],m)
    return im
def pad(b,f=0.25):   # attendee boxes are hand-marked tight; grow 25% each way so chins/foreheads are covered
    x0,y0,x1,y1=b; dx=(x1-x0)*f/2; dy=(y1-y0)*f/2
    return [max(0,x0-dx),max(0,y0-dy),min(100,x1+dx),min(100,y1+dy)]
def mk(r):
    src=f"{TT}/{r['section']}/{r['file']}"; name=os.path.splitext(r['file'])[0]
    with tempfile.TemporaryDirectory() as td:
        t=td+'/a.jpg'; subprocess.run(['sips','-s','format','jpeg','-s','formatOptions','95','-Z','2000',src,'--out',t],capture_output=True)
        im=Image.open(t).convert('RGB')
    o=ori.get(r['file'],1)
    if o in ROT and im.width>im.height: im=im.transpose(ROT[o])
    reg=REG.get(r['n'])
    assert reg or r['model_nude']!='Y', r['n']          # every nude-model photo must have regions
    boxes=[b for k in ('face','body','butt') for b in (reg or {}).get(k,[])]+[pad(b) for b in PEOPLE.get(r['n'],[])]   # people.json: attendees without posting consent
    if boxes: im=blur(im,boxes)
    full=im.copy(); full.thumbnail((1600,1600),Image.LANCZOS); full.save(f"{OUT}/full/{name}.jpg",quality=84,optimize=True,progressive=True)
    th=im.copy(); th.thumbnail((640,640),Image.LANCZOS); th.save(f"{OUT}/thumb/{name}.jpg",quality=78,optimize=True,progressive=True)
    return dict(id=name,n=int(r['n']),section=r['section'][3:],w=full.width,h=full.height,model=bool(REG.get(r['n']) or PEOPLE.get(r['n'])))
with ThreadPoolExecutor(6) as ex: items=list(ex.map(mk,rows))
json.dump(items,open(OUT+'/photos.json','w'),indent=0); print(len(items),'photos ->',OUT)
