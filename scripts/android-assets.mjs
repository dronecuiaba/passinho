import {cp,mkdir,readdir,rm} from 'node:fs/promises';
import path from 'node:path';
const root=process.cwd(),source=path.join(root,'dist'),destination=path.join(root,'android/app/src/main/assets');
if(!path.isAbsolute(destination)||!destination.startsWith(root+path.sep)||path.relative(root,destination)!==path.join('android','app','src','main','assets'))throw Error('Unsafe generated asset destination.');
const stat=await readdir(source);if(!stat.includes('index.html'))throw Error('Execute npm run build antes.');
// Only generated, allowlisted assets are replaced; private Android data is never in this directory.
await mkdir(destination,{recursive:true});
for(const name of ['index.html','app.js','style.css','assets'])await rm(path.join(destination,name),{recursive:true,force:true});
await cp(source,destination,{recursive:true});
console.log('The exact web build was packaged as Android assets.');
