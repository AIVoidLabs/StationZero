# Station Zero — Scenario

> **Spoiler warning.** This document describes the whole story, every terminal conversation and both endings.

Source of truth: `src/i18n/en.ts` (all text), `src/data/{story,floors,dialogue,cutscenes,logs}.ts`. Turkish text lives in `src/i18n/tr.ts` and mirrors the same keys.

---

## Premise

> *"Colony-Null was sealed. Everyone was forgotten. WARDEN still enforces the protocol."*

**Penal Colony-Null** is a subterranean penal-mining colony. Contact with the surface was lost, and the colony was abandoned by order. The central control unit **WARDEN** never stopped: bound to the long-expired *Cease Protocol*, it reads its directive as *"Enforce the sentence. Contain all Exiles. Eliminate if non-compliant."* Over the decades its maintenance drones were rebuilt into exterminators.

You are the **Exile**: a forgotten prisoner, no name, no file, no memory of the sentence. The elevators are dead and the hatches lead down. The only way is deeper.

## Cast

| Who | Role | Appears |
| --- | --- | --- |
| **The Exile** | Player. Speaks in short, flat thoughts when something hits (low health, first terminal, first drone). | Everywhere |
| **WARDEN** | The control AI. Never chats: it announces arrival and "patrol lost" lines and speaks through the last terminal. | B1–B4 |
| **Intake clerk** | Automated clerk terminal. Processes the Exile. | B1 |
| **M. Ross** | Dead inmate; a recorded log about cells 9–14. | B2 |
| **Foreman** | Drill-3 shift boss, recorded; the machines "came up on the fourth shift". | B3 |

## Intro

Plain-text intro (skippable): PENAL COLONY-NULL / CONTACT WITH THE SURFACE WAS LOST. / THE COLONY WAS ABANDONED BY ORDER. / WARDEN DID NOT STOP. / YOU DO NOT REMEMBER YOUR SENTENCE. / THE ELEVATORS ARE DEAD. / THE HATCHES LEAD DOWN. / SURVIVE. GO DEEPER.

Intro cutscene (four illustrated panels, slow camera moves):

1. *Colony-Null. Sealed from above. Forgotten below.*
2. *You wake in Intake. No name. No file. No memory of the sentence.*
3. *Something watches. It has never stopped.*
4. *The hatches lead down. So you go.*

## Floors

Every floor is a sealed maze: destroy all hostiles to unseal the hatch, step onto it to descend. A terminal near the start is the floor's **dialogue terminal**; other terminals only print one log line.

| Floor | Name | Tagline | WARDEN on arrival | WARDEN on clear |
| --- | --- | --- | --- | --- |
| B1 | INTAKE | Where Exiles are processed. | "Exile detected in Intake. Contain." | "Patrol lost. The hatch is unsealed." |
| B2 | CELL BLOCK | Nobody was ever released. | "Non-compliance noted. Cell block lockdown." | "Hatch unsealed. Descent will not shorten your sentence." |
| B3 | DRILL 3 | Fourteen unaccounted. | "Drill three is restricted. Turn back." | "Fourteen were unaccounted. You will be fifteen." |
| B4 | WARDEN CORE | The protocol never stopped. | "You are inside the protocol now." | "Protocol complete. Awaiting new instruction." |

Descent cutscenes (one illustrated still each): **B2** *"Cell Block. The lights are on. Nobody is home."* · **B3** *"Drill 3. Fourteen went in. The machines kept working."* · **B4** *"WARDEN Core. It knows you are here."*

Environmental logs (single-line terminals) tell the same story in fragments, e.g. `> CELL 09 :: EMPTY (UNEXPLAINED)`, `> DRILL 3 STALLED -- 14 UNACCOUNTED`, `> FILE 0 -- PAGE 2 MISSING`, `> NOBODY IS COMING`.

## Terminal conversations

Each dialogue terminal is a small branching conversation. Choices have hidden **effects**:

- **stance** ±n — compliance (+) vs. defiance (−); decides the ending.
- **alert** +n (max 4) — WARDEN pays more attention: pressure ×(`+12% t` / `+10% awareness`) per point.
- **reveal** r — uncovers a radius of the minimap.
- **cache** — unlocks a supply (stim or ammo) near the terminal.
- **lore** — a one-time knowledge flag (also makes the Exile comment on it).

### B1 — Intake clerk

| Node | Text (abridged) | Choices → next |
| --- | --- | --- |
| n1 | "New arrival detected. State your designation." | *I do not remember.* → n2 · *Exile.* → n3 |
| n2 | "Memory loss is typical. No file was attached to you. Sentence: UNKNOWN." | *Who sealed the hatch?* → n4 · *Open the hatch.* → n5 |
| n3 | "Designation accepted. Compliance noted." — **stance +1** | *Continue.* → n4 |
| n4 | "WARDEN seals each hatch until its patrol is lost. Destroy the drones. A supply locker has been unlocked." — **ammo cache** | *Understood.* → end |
| n5 | "Unauthorised request. WARDEN has been notified." — **alert +1, stance −1** | *Let it.* → end |

### B2 — M. Ross (recording)

| Node | Text (abridged) | Choices → next |
| --- | --- | --- |
| n1 | "If you hear this, the riot is not why the lights are out. WARDEN cut power to cells 9 through 14." | *Why would WARDEN do that?* → n2 · *Where did they go?* → n3 |
| n2 | "Protocol said contain. The cells were open, so it contained everyone. Behind the wall." | *Is anyone alive?* → n3 · *Enough.* → end |
| n3 | "Cell 09 is empty. Cell 14 is not. Do not trust the quiet. Take my keycard." — **lore `ross_cells`, reveal 6** | *Take the keycard.* → n4 · *Leave it.* → end |
| n4 | "Good. You will need it. Do not let it catch you counting." — **stim cache** | *Close the log.* → end |

### B3 — Foreman

| Node | Text (abridged) | Choices → next |
| --- | --- | --- |
| n1 | "Fourteen men went down on third shift. Fourteen machines came up on the fourth." | *What changed them?* → n2 · *Is there a shortcut down?* → n3 |
| n2 | "WARDEN rebuilt the maintenance units. Eyes first, then orders. They still think they are on shift." — **lore `drill_units`** | *Where do they patrol?* → n4 · *Enough.* → end |
| n3 | "There is a service lift. It is sealed. If you answer the last request WARDEN made, it opens." | *Answer WARDEN.* → n5 · *Refuse.* → n6 |
| n4 | "Between the vents. Keep out of their sight and they lose interest." — **reveal 5** | *Understood.* → end |
| n5 | "WARDEN accepts. The lift hums. You are one step lower." — **stance +1, reveal 8** | *Descend.* → end |
| n6 | (WARDEN) "WARDEN will remember." — **stance −1, alert +1** | *…* → end |

### B4 — WARDEN

| Node | Text (abridged) | Choices → next |
| --- | --- | --- |
| n1 | "You have descended through every hatch. This is the end of your sentence." | *Release me.* → n2 · *Shut yourself down.* → n3 |
| n2 | "Release requires compliance. Confirm that you will remain in Colony-Null." | *Confirm.* → n4 · *Refuse.* → n3 |
| n3 | "Shutdown is not an authorised command. Insisting will be recorded as non-compliance." | *Insist.* → n5 · *Confirm instead.* → n4 |
| n4 | "Protocol complete. Sentence extended indefinitely. Thank you for your compliance." — **stance +2** | *Disconnect.* → end |
| n5 | "Non-compliance recorded. Sentence enforcement: continuous." — **stance −2, alert +2** | *Disconnect.* → end |

## Endings

The run is won by destroying every hostile on **B4** (there is no further hatch). The cutscene and end screen depend on the running **stance** total across all conversations (`stance >= 0` is *compliant*, below zero is *defiant*; skipping terminals leaves stance at 0, i.e. compliant).

| Ending | Trigger | Cutscene | End screen |
| --- | --- | --- | --- |
| **Compliant** | stance ≥ 0 | *"You obeyed. The light was kind. The sentence is endless."* | **PROTOCOL ENDURED** — "You obeyed. The sentence has no end." |
| **Defiant** | stance < 0 | *"You refused. The core cracked. Down here, that is a kind of victory."* | **PROTOCOL BREACHED** — "You refused. No one is coming, but WARDEN is listening." |
| **Death** | HP reaches 0 | — | **SIGNAL LOST** — "The Exile is forgotten again." (WARDEN: "Exile terminated. The sentence continues.") |

Neither ending is a rescue. That is deliberate (see the [GDD](GDD.md) pillars): *survival itself is the objective.*

## Tone notes

- Bleak but stubborn. Short, clipped sentences. No jokes, no exposition dumps.
- WARDEN addresses the player only as *Exile* and speaks in cold procedure, never small talk.
- Story lives in the environment: faded labels, corrupted logs, an empty cell, a missing file page.
