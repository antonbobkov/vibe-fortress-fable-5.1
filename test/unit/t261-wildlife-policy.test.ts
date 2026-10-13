import { describe, expect, it } from 'vitest';
import { measuredBounds, regressionCheck, distribution } from '../perf/wildlife_year_measurements';
const before={median:12.5,worst:3,secondWorst:10,living:135,wildlifeFree:7,extinct:0,hungerThirstDeaths:2};
const best={...before,wildlifeFree:8};
describe('T-261 annual policy guards the distribution rather than its single worst seed',()=>{
 it('T-308: computes the living-sum, extinction and need-death tolerances from measured figures',()=>{
  expect(measuredBounds(best)).toEqual({median:11.5,living:123,wildlifeFree:6,extinct:1,hungerThirstDeaths:3});
 });
 it('accepts the measured late-infection correction while still reporting its extinction',()=>{
  expect(regressionCheck(before,{...before,worst:0,wildlifeFree:8,extinct:1},best))
   .toMatchObject({allowed:true,worsened:['extinct'],exceeded:[]});
 });
 it('allows two tolerated losses but rejects three concurrent losses',()=>{
  expect(regressionCheck(before,{...before,worst:0,extinct:1,hungerThirstDeaths:3},best).allowed).toBe(true);
  expect(regressionCheck(before,{...before,median:12,living:130,wildlifeFree:6},best))
   .toMatchObject({allowed:false,worsened:['median','living','wildlifeFree'],exceeded:[]});
 });
 it('T-308: rejects a living sum below its floor even when the median improves',()=>{
  expect(regressionCheck(before,{...before,median:13,living:122},best))
   .toMatchObject({allowed:false,exceeded:['living']});
 });
 it('computes the second-lowest of twelve and the sum, and includes the wiped-out year in the median',()=>{
  expect(distribution([0,11,10,10,10,12,13,13,15,14,15,14].map(living=>({living,deaths:[]}))))
   .toMatchObject({median:12.5,worst:0,secondWorst:10,living:137,extinct:1,seeds:12});
 });
});
