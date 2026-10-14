#!/usr/bin/env python3
"""Gera um visual original inspirado em interfaces de desktop modernas."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont
import math

OUT = Path(__file__).parent
S = 2
W, H = 854 * S, 480 * S


def cubic(a, b, c, d, t):
    q = 1 - t
    return q**3 * a + 3*q*q*t*b + 3*q*t*t*c + t**3*d


def ribbon(image, points, width, colors, opacity=240):
    center = [(cubic(*(p[0] for p in points), i/90),
               cubic(*(p[1] for p in points), i/90)) for i in range(91)]
    left, right = [], []
    for i, (x, y) in enumerate(center):
        x0, y0 = center[max(0, i-1)]
        x1, y1 = center[min(90, i+1)]
        length = max(1, math.hypot(x1-x0, y1-y0))
        nx, ny = -(y1-y0)/length, (x1-x0)/length
        thickness = width * (0.78 + 0.24 * math.sin(math.pi*i/90))
        left.append((x+nx*thickness/2, y+ny*thickness/2))
        right.append((x-nx*thickness/2, y-ny*thickness/2))
    mask = Image.new('L', (W, H), 0)
    ImageDraw.Draw(mask).polygon(left + right[::-1], fill=opacity)
    shade = Image.new('RGBA', (W, H))
    pix = shade.load()
    for y in range(H):
        t = y / (H-1)
        color = tuple(round(colors[0][j]*(1-t)+colors[1][j]*t) for j in range(3))
        for x in range(W):
            pix[x, y] = (*color, 255)
    shadow = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    shadow.putalpha(mask.filter(ImageFilter.GaussianBlur(38*S)))
    black = Image.new('RGBA', (W, H), (11, 44, 89, 0))
    black.putalpha(shadow.getchannel('A').point(lambda p: round(p*.35)))
    image.alpha_composite(black, (12*S, 13*S))
    shade.putalpha(mask)
    image.alpha_composite(shade)
    ImageDraw.Draw(image).line(center, fill=(234, 250, 255, 82), width=2*S, joint='curve')


def wallpaper():
    image = Image.new('RGBA', (W, H))
    pix = image.load()
    for y in range(H):
        for x in range(W):
            t = .58*x/W + .42*y/H
            glow = max(0, 1-math.hypot((x/W-.55)*1.35, (y/H-.43)*1.7))
            pix[x,y] = (round(197-77*t+39*glow), round(227-57*t+20*glow),
                        round(248-23*t+7*glow), 255)
    bloom = Image.new('RGBA', (W,H), (0,0,0,0))
    draw = ImageDraw.Draw(bloom)
    draw.ellipse((330*S,45*S,680*S,390*S), fill=(234,249,255,80))
    draw.ellipse((150*S,190*S,540*S,560*S), fill=(48,121,226,80))
    image.alpha_composite(bloom.filter(ImageFilter.GaussianBlur(60*S)))
    ribbon(image, [(90*S,390*S),(230*S,-85*S),(760*S,-55*S),(705*S,440*S)],
           96*S, ((38,135,236),(21,76,187)), 232)
    ribbon(image, [(196*S,445*S),(320*S,95*S),(590*S,82*S),(760*S,380*S)],
           94*S, ((126,209,255),(43,130,230)), 235)
    ribbon(image, [(290*S,455*S),(440*S,310*S),(635*S,455*S),(790*S,135*S)],
           84*S, ((216,247,255),(69,161,243)), 225)
    ribbon(image, [(295*S,74*S),(440*S,220*S),(480*S,440*S),(845*S,450*S)],
           54*S, ((226,250,255),(56,142,231)), 200)
    image.convert('RGB').resize((854,480),Image.Resampling.LANCZOS).save(OUT/'wallpaper.png')


def icon(name, paint):
    size=160
    image=Image.new('RGBA',(size,size),(0,0,0,0))
    d=ImageDraw.Draw(image)
    paint(d,size)
    image.resize((40,40),Image.Resampling.LANCZOS).save(OUT/(name+'.png'))


def icons():
    def start(d,s):
        d.rounded_rectangle((14,14,146,146),radius=34,fill='#2279db')
        pts=[(56,45),(102,45),(70,80),(105,80),(105,111),(54,111),(88,78),(56,78)]
        d.line(pts,fill='#ffffff',width=15,joint='curve')
    def browser(d,s):
        d.ellipse((15,15,145,145),fill='#f7fbff',outline='#2975d8',width=10)
        d.ellipse((48,16,112,145),outline='#2975d8',width=7)
        d.line((20,80,140,80),fill='#2975d8',width=8)
        d.arc((17,38,143,122),0,180,fill='#2975d8',width=7)
    def files(d,s):
        d.rounded_rectangle((16,44,145,132),radius=15,fill='#e8a831',outline='#a86f1e',width=6)
        d.rounded_rectangle((21,31,80,63),radius=9,fill='#f8c753')
        d.rounded_rectangle((22,62,139,124),radius=11,fill='#ffd87a')
    def terminal(d,s):
        d.rounded_rectangle((16,20,144,140),radius=20,fill='#17294a')
        d.line((42,56,69,80,42,104),fill='#7ed9ff',width=11,joint='curve')
        d.line((83,105,117,105),fill='#ecf7ff',width=10)
    for name,paint in [('start',start),('browser',browser),('files',files),('terminal',terminal)]:
        icon(name,paint)


if __name__=='__main__':
    wallpaper()
    icons()
