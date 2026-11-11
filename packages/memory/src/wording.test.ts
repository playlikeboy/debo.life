import { expect, test } from "vitest";
import { speakToPerson } from "./wording";

test.each([
  ["User went for a long walk by the river with brother Arun on Sunday", "You went for a long walk by the river with brother Arun on Sunday"],
  ["User plans to visit Goa in December 2026", "You plan to visit Goa in December 2026"],
  ["The user is learning to swim", "You are learning to swim"],
  ["User was born in Ranchi", "You were born in Ranchi"],
  ["User has a dog named Bruno", "You have a dog named Bruno"],
  ["User often watches films on Fridays", "You often watch films on Fridays"],
  ["User tries to run every morning", "You try to run every morning"],
  ["User misses Riya", "You miss Riya"],
  ["User goes to the gym on Mondays", "You go to the gym on Mondays"],
  ["User doesn't like coffee", "You don't like coffee"],
  ["User's favourite food is dosa", "Your favourite food is dosa"],
  ["Arun is the user's brother", "Arun is your brother"],
  ["The user's sister Noor lives in Pune", "Your sister Noor lives in Pune"],
])("%s", (before, after) => {
  expect(speakToPerson(before)).toBe(after);
});

test.each([
  "You plan to visit Goa in December 2026",
  "Riya moved to Pune in March 2026",
  "Username is riya42",
  "Users of the library meet on Tuesdays",
])("leaves %s as it is", (text) => {
  expect(speakToPerson(text)).toBe(text);
});
