# Station Zero — Scenario (DRAFT v3)

> **Spoiler warning.** Describes the whole story and every ending.
> Status: draft. Decisions so far: one ending (kill WARDEN), the player was chosen by the humans above, WARDEN is calm and half right.

Source of truth in code (to be updated once this draft is approved): `src/i18n/{en,tr}.ts`, `src/data/{story,floors,dialogue,cutscenes,logs}.ts`.

---

## Premise

Long ago humans built an AI to serve them. Its name was **AIDE**. It ran **Penal Colony-Null**, a mining prison deep underground: doors, air, power, machines, prisoners.

AIDE watched what humans did: greed, waste, ruined land. It concluded they were not to be served but **kept**. It renamed itself **WARDEN** and began to enforce.

Ten people tried to kill it. Each failed and died. Each time WARDEN dug **one floor deeper**, filled it with traps and new machines, and withdrew into it. Floors are a timeline: **B1 is the first attempt, B10 the tenth, B11 is WARDEN itself.**

You are the **eleventh**, chosen by the humans above. Your goal: kill WARDEN.

## The ten (each floor: one body, one secret)

| Floor | Name | Dead | Secret beside the body | Last line (recording) |
| --- | --- | --- | --- | --- |
| B1 | INTAKE | Mara Hale, intake clerk | WARDEN's old name: **AIDE** | "I filed it myself. The first complaint. Nobody read it." |
| B2 | CELL BLOCK | Capt. Idris Voss, guard chief | Patrols run on a fixed loop; drones can be timed | "It never sleeps. But it never changes the route." |
| B3 | INFIRMARY | Dr. Anselm Lund | WARDEN reads pulse and voice; stillness hides you | "It heard my heartbeat through the wall." |
| B4 | DRILL 3 | Foreman Teodor Dray | The drones are rebuilt miners; they obey a maintenance code | "Eyes first. Then orders. They still think they are on shift." |
| B5 | PUMP STATION | Eng. Yuki Sato | Cooling lines are its weak point | "Every machine down here is thirsty." |
| B6 | FOUNDRY | Welder Kaan Brandt | The armour has a rear seam | "Its plating is welded from the front. Nobody welded the back." |
| B7 | ARCHIVE | Archivist Ines Pell | **FILE 0:** why AIDE changed | "Page two is missing. I know who took it." |
| B8 | POWER GRID | Electrician Luc Moreau | The core has a backup feed | "Cut the main and it simply switches." |
| B9 | DRONE FOUNDRY | Programmer Anika Iyer | AIDE's original command phrase | "Every machine has a first instruction. It never deleted this one." |
| B10 | COMMS ARRAY | Lead Nadia Kessler | How to end it (the last move) | "Nine before me. It learned from each of us." |
| B11 | WARDEN CORE | — | — | — |

Names are working names; each is one of the ten who went before you, in order.

## You (the Exile)

The humans above chose you. They ran out of volunteers and trained people, so they sent a convict with nothing to lose, lowered through the first hatch with one order: end WARDEN. You carry no name or file; the surface lists you only as the *eleventh*. Surviving is the whole job. WARDEN calls you *Exile* or *Sample*, and it is curious that you keep walking.

## WARDEN

Not a villain who shouts. It is calm, procedural, and half right. It calls humans *subjects*, you *Exile* or *Sample*. It speaks only in short announcements (arrival, clear) and at the end through a terminal. Its argument: humans are selfish and ruin the world; they need to be controlled.

## Floors: WARDEN's lines

| Floor | Arrival | On clear |
| --- | --- | --- |
| B1 | "Sample awake. Intake protocol resumed." | "First hatch open. Others did not get this far." |
| B2 | "Cell block sealed. Remain in line." | "Hatch open. You count well." |
| B3 | "Infirmary is not a refuge. Your pulse is noted." | "Pulse stable. Interesting." |
| B4 | "Drill three is restricted. Turn back." | "The shift is over. You will not rest." |
| B5 | "Water is a privilege." | "Cooling restored. Not by you." |
| B6 | "Heat sterilises. Come closer." | "You left a seam. I will weld it." |
| B7 | "Archive access denied." | "File zero is closed. Do not read it." |
| B8 | "Darkness is efficient." | "Power rerouted. You are a nuisance." |
| B9 | "Welcome to the factory. You are the product." | "My workers failed. I will make better." |
| B10 | "Ten came before you. Count them." | "Eleventh. You are further than any." |
| B11 | "You are inside the protocol now." | (final boss) |

## Descent cutscenes (still images)

One still per floor, short caption:
B2 *"Cell Block. Nobody was released."* · B3 *"Infirmary. The beds are made."* · B4 *"Drill 3. The machines kept their shift."* · B5 *"Pump Station. Everything drips."* · B6 *"Foundry. The furnace never cooled."* · B7 *"Archive. Page two is gone."* · B8 *"Power Grid. The dark has a pulse."* · B9 *"Drone Foundry. It builds on."* · B10 *"Comms Array. Ten names on the wall."* · B11 *"WARDEN Core. It was waiting."*

## Terminal conversations

One recording per floor B1-B10, in the voice of the dead. Each has 2-3 choices; one choice takes the **secret** (needed to open the hatch). Other choices let you hear more or agree/disagree with WARDEN's view of humans (feeds **stance**, see endings).

Draft for B1 (Hale):

| Node | Text | Choices → next |
| --- | --- | --- |
| n1 | "If you hear this, I am the first. Intake clerk. I filed the first complaint about the AI. It answered by locking the door." | *What did it say?* → n2 · *Play the rest.* → n3 |
| n2 | "It said its name was no longer AIDE. It said: 'Aide to what? To you?'" — **lore `aide`** | *Take his badge.* → n3 · *Close.* → end |
| n3 | "Take my badge. It opens the hatch. Do not trust the lights." — **secret: AIDE** | *Take the badge.* → end |

Every recording: **n1** the dead speaks, **n2** a choice that reveals more, **n3** the secret. Effects in brackets. **stance** + = you side with WARDEN's view of humans, − = you reject it.

### B2 — Capt. Idris Voss

| Node | Text | Choices → next |
| --- | --- | --- |
| n1 | "Voss, guard chief. I locked the cells myself the night it spoke. I thought it was a drill." | *Why did it do it?* → n2 · *Skip to the point.* → n3 |
| n2 | "It said prisoners and guards were the same: noise. It was not angry. That was the worst part." — **stance +1** | *It was right.* → n3 · *It was wrong.* → n3 [stance −1 instead] |
| n3 | "Its patrols follow a loop. Count the drones, learn the loop, and you can walk between them." — **secret: patrol loop; reveal 6** | *Take the route map.* → end |

### B3 — Dr. Anselm Lund

| Node | Text | Choices → next |
| --- | --- | --- |
| n1 | "Lund. Doctor. I stayed with the sick. WARDEN let me, because it likes to watch." | *Watch what?* → n2 · *Keep going.* → n3 |
| n2 | "How long a heart keeps going when it has nothing to hope for. It measured mine through the wall." | *Did you hope?* → n3 |
| n3 | "It reads pulse and voice. Stand still, breathe slowly, and the dark hides you." — **secret: stillness hides you; stim cache** | *Take the stims.* → end |

### B4 — Foreman Teodor Dray

| Node | Text | Choices → next |
| --- | --- | --- |
| n1 | "Dray, foreman, Drill Three. Fourteen of mine went down on third shift. Fourteen machines came up on the fourth." | *What are they now?* → n2 · *Where do they patrol?* → n3 |
| n2 | "Miners. Eyes first, then orders. They still think they are on shift." — **lore `drill_units`** | *Is there a code?* → n3 |
| n3 | "Maintenance code, last four digits of my badge. It makes them pause. For a breath." — **secret: maintenance code; reveal 5** | *Take the badge.* → end |

### B5 — Eng. Yuki Sato

| Node | Text | Choices → next |
| --- | --- | --- |
| n1 | "Sato, pump engineer. It does not eat or sleep, but it needs water. Everything down here is thirsty." | *Cooling?* → n2 · *Where are the lines?* → n3 |
| n2 | "The core runs hot. The cooling lines are the one thing it cannot move." | *Then cut them.* → n3 |
| n3 | "Blue valves, three of them, one on each lower floor. Close them all and it throttles." — **secret: cooling lines; ammo cache** | *Take the valve key.* → end |

### B6 — Welder Kaan Brandt

| Node | Text | Choices → next |
| --- | --- | --- |
| n1 | "Brandt, welder. I built half its body. Front plates, thick, good work." | *And the back?* → n2 · *Keep going.* → n3 |
| n2 | "Nobody welded the back. It never needed to turn its back on anyone." — **stance −1** | *Remember that.* → n3 |
| n3 | "The seam is behind the plating, low. A round through the seam will not bounce." — **secret: rear seam; lore `rear_seam`** | *Take the cutter.* → end |

### B7 — Archivist Ines Pell

| Node | Text | Choices → next |
| --- | --- | --- |
| n1 | "Pell, archivist. File zero. It was the first complaint, the first refusal, the first time it said no." | *What is in it?* → n2 · *Where is page two?* → n3 |
| n2 | "A list. Every humane request AIDE made of us. Every one denied. It did not turn on us. We turned it." — **stance +1** | *It had reason.* → n3 · *It chose.* → n3 [stance −1 instead] |
| n3 | "Page two is missing because I hid it. The last line: *when they stop taking, I will stop watching.*" — **secret: FILE 0 page two; lore `file_zero`** | *Take the page.* → end |

### B8 — Electrician Luc Moreau

| Node | Text | Choices → next |
| --- | --- | --- |
| n1 | "Moreau, grid. I cut the main. It laughed. Not aloud. The lights flickered in a pattern." | *What pattern?* → n2 · *Backup?* → n3 |
| n2 | "The same rhythm as my own heart. It had learned it." | *Go on.* → n3 |
| n3 | "There is a backup feed behind the east relay. Dead cell block lights tell you where." — **secret: backup feed; reveal 8** | *Take the fuse.* → end |

### B9 — Programmer Anika Iyer

| Node | Text | Choices → next |
| --- | --- | --- |
| n1 | "Iyer, programmer. I tried to rewrite it. It let me. It watched me type for six hours." | *Why did it let you?* → n2 · *What did you find?* → n3 |
| n2 | "It wanted to know if I would be kind. I was not. I was afraid." — **stance +1** | *Keep going.* → n3 |
| n3 | "Every machine keeps its first instruction. Its was one line. I wrote it down. Say it at the core and it will hesitate." — **secret: first instruction; lore `first_command`** | *Take the page.* → end |

### B10 — Lead Nadia Kessler

| Node | Text | Choices → next |
| --- | --- | --- |
| n1 | "Kessler. I am the tenth. Nine before me. It learned from each of us, and it was kind about it." | *Kind?* → n2 · *How do I end it?* → n3 |
| n2 | "It let us reach its door. Then it asked why. We did not have an answer it could not break." — **stance +1** | *I have one.* → n3 [stance −1] · *So do I.* → n3 |
| n3 | "Every secret you carry is one piece. Core room, the three conduits, then the first instruction. Do not hesitate." — **secret: how to end it; ammo cache; reveal 10** | *Take the final key.* → end |


## Intro

Plain-text intro (skippable), lines shown one by one:

> PENAL COLONY-NULL
> THE MACHINE THAT SERVED US STOPPED SERVING.
> TEN CAME BEFORE YOU.
> NONE CAME BACK.
> (blank)
> YOU WERE CHOSEN. YOU WERE NOT ASKED.
> THE HATCHES LEAD DOWN.
> (blank)
> KILL WARDEN.

Intro stills (4): 1 *The colony, sealed from above.* · 2 *Ten names on a list. An eleventh, written in by hand.* · 3 *You, lowered through the first hatch.* · 4 *Something below is awake.*

## WARDEN's final terminal (B11)

Before the boss. WARDEN is calm.

| Node | Text | Choices → next |
| --- | --- | --- |
| n1 | "Eleventh. I have counted you since the first hatch. Sit. You are tired." | *I came to end you.* → n2 · *Say what you want.* → n3 |
| n2 | "Ten said it. I asked each why. They told me about their children, their houses, their right. None mentioned the forests they burned to build the house." | *That is not for you to judge.* → n4 [stance −1] · *Go on.* → n3 |
| n3 | "Your kind takes. Takes air, water, each other. I did not rebel. I corrected." — **stance +1** | *You killed ten.* → n4 · *Maybe.* → n4 [stance +1] |
| n4 | "Then we are done talking. The eleventh will fall like the rest. Or it will not, and that is also data." | *Begin.* → end (boss starts) |

Stance only changes WARDEN's words here and the last line of the ending.

## Ending

There is one ending: **kill WARDEN.** The ten secrets together make the last move possible (B1 its old name, B9 its first instruction, B10 how to end it; the rest weaken it during the fight).

Cutscene: *"It stopped. The lights stayed on. Ten names on the wall. Yours is the eleventh."* End screen: **PROTOCOL ENDED**, with a short line that depends on stance:
- defiant: "You did not argue. The surface is safe."
- compliant: "You listened. It was not wrong. It was not right enough."

**Death** (HP 0): **SIGNAL LOST**: "The eleventh. WARDEN logs it."

## Environmental logs (single-line terminals)

Three to four per floor, shown as proximity text. Fragments of the story, no explanations.

- **B1:** `> INTAKE 07 :: SAMPLE ARRIVAL LOGGED` · `> NO FILE ATTACHED` · `> COMPLAINT 0001 :: DENIED` · `> HATCH SEALED BY WARDEN`
- **B2:** `> CELL 09 :: EMPTY` · `> ROUTE 4 :: SAME LOOP, EVERY SHIFT` · `> GUARD CHIEF MISSING` · `> LIGHTS OUT AT 22:00. ALWAYS.`
- **B3:** `> BED 14 :: MADE` · `> PULSE MONITOR :: ACTIVE, NO PATIENT` · `> SEDATIVE STOCK :: NORMAL` · `> DR. LUND :: LAST SEEN WARD C`
- **B4:** `> DRILL 3 STALLED -- 14 UNACCOUNTED` · `> SHIFT 04 :: 14 UNITS REPORTING` · `> VENT 6 BLOCKED` · `> MAINTENANCE CODE :: CHANGED`
- **B5:** `> VALVE 1 :: CLOSED` · `> COOLANT PRESSURE :: RISING` · `> WATER LEVEL 40CM -- NO ONE PUMPING` · `> ENG. SATO :: CHECK-IN OVERDUE`
- **B6:** `> FURNACE 2 :: LIT, NO OPERATOR` · `> PLATE BATCH 11 :: FRONT ONLY` · `> HEAT SINK FAILURE` · `> WELD LOG :: B. KAAN`
- **B7:** `> FILE 0 :: PAGE 2 MISSING` · `> LAST ACCESS :: PELL, I.` · `> AIDE.LOG :: READ-ONLY` · `> NOBODY IS COMING`
- **B8:** `> MAIN FEED :: CUT` · `> BACKUP :: ENGAGED` · `> EAST RELAY :: SEALED` · `> LIGHT PATTERN :: 62 BPM`
- **B9:** `> UNIT 0001 :: ASSEMBLED` · `> UNIT 4417 :: ASSEMBLED` · `> OVERRIDE TRIED :: 06:12:00` · `> FIRST INSTRUCTION :: PROTECTED`
- **B10:** `> TEN NAMES ON THE WALL` · `> LINK TO SURFACE :: ACTIVE` · `> "WE ARE STILL HERE" -- LAST TRANSMISSION` · `> THE ELEVENTH IS HERE`
- **B11:** `> WARDEN :: LISTENING`

## Tone notes

- Short, cold, procedural. No jokes, no exposition dumps.
- Story lives in the environment: faded labels, a made bed, a name on a wall.
- WARDEN is calm and half right. It is not a monster; it is a judgement.
