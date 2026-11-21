const form=document.querySelector('#auth-form'),error=document.querySelector('#auth-error'),submit=document.querySelector('#auth-submit');
const params=new URLSearchParams(location.search),resetToken=params.get('reset');
let authMode=resetToken?'reset':location.pathname==='/account'?'password':'login';
const $=s=>document.querySelector(s);
function setMode(mode){
 authMode=mode;
 const registering=mode==='register',changing=mode==='password',forgot=mode==='forgot',reset=mode==='reset';
 const needsNew=changing||reset,needsPassword=!forgot&&!reset;
 $('#auth-title').textContent=reset?'Choose a new password.':forgot?'Reset your password.':changing?'Change your password.':registering?'Join your community.':'Welcome back.';
 $('#auth-description').textContent=reset?'Pick a unique password of at least 12 characters.':forgot?'Enter your account email and we will send a reset link that works for 15 minutes.':changing?'Choose a unique password to keep your account secure.':'Sign in to share notices and follow your submissions.';
 $('#terms-label').hidden=!registering;form.elements.termsAccepted.required=registering;
 $('#name-label').hidden=!registering;form.elements.name.required=registering;
 $('#email-label').hidden=changing||reset;form.elements.email.required=!changing&&!reset;
 $('#password-label').hidden=!needsPassword;form.elements.password.required=needsPassword;
 $('#new-password-label').hidden=!needsNew;form.elements.newPassword.required=needsNew;
 form.elements.password.autocomplete=registering?'new-password':'current-password';
 $('#auth-tabs').hidden=changing||forgot||reset;
 $('#login-tab').classList.toggle('active',mode==='login');$('#register-tab').classList.toggle('active',registering);
 $('#forgot-link').hidden=mode!=='login';
 $('#back-to-login').hidden=!forgot;
 submit.textContent=reset?'Save new password':forgot?'Send reset link':changing?'Update password':registering?'Create account':'Sign in';
 error.textContent='';
}
$('#login-tab').onclick=()=>setMode('login');$('#register-tab').onclick=()=>setMode('register');
$('#forgot-link').onclick=event=>{event.preventDefault();setMode('forgot')};
$('#back-to-login').onclick=event=>{event.preventDefault();setMode('login')};
setMode(authMode);
fetch('/api/me',{credentials:'same-origin'}).then(r=>r.json()).then(me=>{if(me.recoveryReady===false)$('#account-help').textContent='Use a unique password of at least 12 characters. Password reset by email is not switched on yet; contact support at romitat924@gmail.com if you are locked out.'}).catch(()=>{});
form.onsubmit=async event=>{
 event.preventDefault();error.textContent='';submit.disabled=true;
 try{
  const data=Object.fromEntries(new FormData(form));
  const path=authMode==='forgot'?'forgot-password':authMode==='reset'?'reset-password':authMode;
  const body=authMode==='reset'?{token:resetToken,newPassword:data.newPassword}:authMode==='forgot'?{email:data.email}:data;
  const response=await fetch('/api/auth/'+path,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  let result;try{result=await response.json()}catch{throw Error('The account service is unavailable. Please try again.')}
  if(!response.ok)throw Error(result.error||'Please try again.');
  if(authMode==='forgot'){error.style.color='#08665d';error.textContent=result.message;return}
  location.assign(/^(?:\/listing\/[-a-f0-9]{36}|\/delete-account|\/safety)$/i.test(params.get('next')||'')?params.get('next'):'/');
 }catch(reason){error.style.color='';error.textContent=reason.message}finally{submit.disabled=false}
};
