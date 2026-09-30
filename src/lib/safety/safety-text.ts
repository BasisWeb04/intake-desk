import type { SafetyKind } from "../domain/types";

/**
 * Fixed safety instructions. These are the only texts shown when a safety rule fires.
 * They are constants on purpose: no extractor, model or template may rewrite them.
 */
export const SAFETY_INSTRUCTIONS: Readonly<Record<SafetyKind, string>> = Object.freeze({
  gas:
    "Possible gas leak. Stop what you are doing and leave the building now with everyone inside. " +
    "Do not switch lights or appliances on or off, do not light anything, and do not use your phone until you are outside. " +
    "From outside and a safe distance away, call your gas utility's emergency line or 911.",
  "carbon-monoxide":
    "Carbon monoxide alarm. Get everyone, including pets, out into fresh air now and leave the doors open behind you. " +
    "Call 911 from outside. Do not go back in until emergency responders say it is safe.",
  "water-electrical":
    "Water near electrical equipment. Do not touch the water, the panel, outlets or anything plugged in. " +
    "Shut off the main breaker only if you can reach it while standing somewhere completely dry; otherwise leave the area. " +
    "Call 911 if you see sparks, smoke or smell burning.",
});

export const SAFETY_STOP_NOTE =
  "I have stopped the booking so you can act on this first. This ticket is marked Emergency: safety and our " +
  "dispatcher will see it at the top of the queue. Please do not wait for us to call before getting safe.";
