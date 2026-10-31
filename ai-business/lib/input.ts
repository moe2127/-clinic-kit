import { z } from 'zod';
import Papa from 'papaparse';
import { monthSchema,noteUrl,industries } from './domain';
const url=z.string().max(400).refine(v=>v===''||noteUrl(v),'noteのメンバーシップURLを入力してください');
export const settingsSchema=z.object({prices:z.object({light:z.number().int().min(1).max(100000),standard:z.number().int().min(1).max(100000),premium:z.number().int().min(1).max(100000)}).strict(),noteUrls:z.object({light:url,standard:url,premium:url}).strict(),monthlyAiLimit:z.number().int().min(0).max(100000),automation:z.boolean(),industry:z.enum(industries)}).strict();
const nonBlank=(value:unknown)=>typeof value==='string'&&value.trim()===''?undefined:value;
const n=z.preprocess(nonBlank,z.coerce.number().min(0).max(1000000000).finite());const integer=z.preprocess(nonBlank,z.coerce.number().int().min(0).max(1000000));
export const metricSchema=z.object({month:monthSchema,plan:z.enum(['light','standard','premium']),revenue:n,members:integer,newMembers:integer,cancelled:integer,openingMembers:integer,otherCost:n,productRevenue:n,productName:z.enum(['月額キット','単品商品']),source:z.string().min(1).max(120)}).strict().refine(r=>r.cancelled<=r.openingMembers,'解約者数は月初会員数以下にしてください').refine(r=>r.productRevenue<=r.revenue,'商品別売上は月間売上の内数です');
export function parseMetrics(csv:string){if(Buffer.byteLength(csv)>100000)throw Error('CSVは100KB以下です');const result=Papa.parse<Record<string,string>>(csv.replace(/^\uFEFF/,''),{header:true,skipEmptyLines:'greedy'});if(result.errors.length)throw Error('CSVの形式が不正です');if(!result.data.length||result.data.length>120)throw Error('CSVは1〜120行にしてください');const rows=result.data.map(r=>metricSchema.parse(r));if(new Set(rows.map(r=>r.month+':'+r.plan)).size!==rows.length)throw Error('同じ月・プランが重複しています');return rows;}
