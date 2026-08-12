import json, base64, subprocess, os, sys
SB = os.path.dirname(os.path.abspath(__file__))
KEY = [l.split('=',1)[1].strip() for l in open(os.path.expanduser('~/AIS-Data-Dashboard/.env')) if l.startswith('GEMINI_API_KEY=')][0]
COMMON = "Instrumental only, no vocals of any kind. A background underscore for a narrated product film: steady flat energy, no drops, no risers, no key changes, no big crescendos, subtle 8-bar evolution so it never feels static. Clean stereo, controlled low end."
PROMPTS = {
 'drive1': "[0:00-0:08] pulse fades in. [0:08-2:50] steady body. 112 bpm. Modern corporate momentum: muted electric-guitar plucks and synth-pluck arpeggio pulse, warm round bass, tight light drums with shaker and rim, optimistic and confident, understated. " + COMMON,
 'drive2': "[0:00-0:08] pulse fades in. [0:08-2:50] steady body. 108 bpm. Warm product-launch underscore: staccato piano chords on the beat, plucked guitar pulse, soft kick and clap groove, hopeful forward motion, premium and restrained. " + COMMON,
 'drive3': "[0:00-0:08] pulse fades in. [0:08-2:50] steady body. 114 bpm. Determined editorial groove: palm-muted guitar sixteenths, analog synth pluck line, driving but quiet drum machine, purposeful optimism. " + COMMON,
 'tech1': "[0:00-0:08] pulse fades in. [0:08-2:50] steady body. 104 bpm. Minimal technology pulse: short-decay synth pluck sixteenth-note pulse, marimba ticks, filtered analog bass, soft muted kick, tiny percussive clicks, sleek and modern, data-clean feel. " + COMMON,
 'tech2': "[0:00-0:08] pulse fades in. [0:08-2:50] steady body. 100 bpm. Quiet motorik underscore: ticking synth sequencer pulse, pizzicato synth accents, deep soft bass, hi-hat sixteenths, precise and futuristic but warm. " + COMMON,
 'tech3': "[0:00-0:08] pulse fades in. [0:08-2:50] steady body. 110 bpm. Minimal electronic momentum: glassy pluck arpeggio, sub bass pulse, rimshot groove, airy top end, modern SaaS keynote energy, understated. " + COMMON,
 'cine1': "[0:00-0:08] ostinato fades in. [0:08-2:50] steady body. 86 bpm. Documentary underscore: running eighth-note piano ostinato, pizzicato cello pulse, warm low strings sustained quietly underneath, soft timpani heartbeat, hopeful gravitas, restrained. " + COMMON,
 'cine2': "[0:00-0:08] ostinato fades in. [0:08-2:50] steady body. 90 bpm. Inspiring institutional underscore: felt-piano ostinato, plucked double bass, light brushed percussion, subtle string swells kept low, forward motion with warmth. " + COMMON,
 'cine3': "[0:00-0:08] ostinato fades in. [0:08-2:50] steady body. 82 bpm. Modern classical pulse: celeste and piano interlocking ostinato, pizzicato strings, quiet cinematic percussion, patient confident build that stays flat. " + COMMON,
}
for name, prompt in PROMPTS.items():
    dest = f'{SB}/{name}.mp3'
    if os.path.exists(dest): print(name, 'exists'); continue
    body = json.dumps({"contents":[{"parts":[{"text":prompt}]}],"generationConfig":{"responseModalities":["AUDIO"]}})
    r = subprocess.run(['curl','-s','-X','POST',
        f'https://generativelanguage.googleapis.com/v1beta/models/lyria-3-pro-preview:generateContent?key={KEY}',
        '-H','Content-Type: application/json','-d',body], capture_output=True, text=True, timeout=600)
    try:
        d = json.loads(r.stdout)
        parts = d['candidates'][0]['content']['parts']
        audio = [p for p in parts if 'inlineData' in p]
        if not audio: print(name, 'NO AUDIO:', json.dumps(d)[:200]); continue
        open(dest,'wb').write(base64.b64decode(audio[0]['inlineData']['data']))
        secs = subprocess.run(['ffprobe','-v','error','-show_entries','format=duration','-of','default=nw=1:nk=1',dest],capture_output=True,text=True).stdout.strip()
        print(name, 'OK', secs, 's')
    except Exception as e:
        print(name, 'FAIL', str(e)[:150], r.stdout[:150])
