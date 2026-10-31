import os,secrets
from fastapi import FastAPI,Header,HTTPException,Request
from kit import build
app=FastAPI(docs_url=None,redoc_url=None,openapi_url=None)
@app.post('/build')
async def generate(request:Request,authorization:str=Header(default='')):
    key=os.environ.get('PYTHON_WORKER_TOKEN','')
    if len(key)<32 or not secrets.compare_digest(authorization,'Bearer '+key):raise HTTPException(401,'Unauthorized')
    raw=await request.body()
    if len(raw)>500000:raise HTTPException(413,'Too large')
    try:return build(await request.json())
    except Exception:raise HTTPException(422,'Invalid kit')
