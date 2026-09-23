"use strict";var wb=Object.create;var nl=Object.defineProperty;var $b=Object.getOwnPropertyDescriptor;var Pb=Object.getOwnPropertyNames;var Mb=Object.getPrototypeOf,Fb=Object.prototype.hasOwnProperty;var Ub=(t,e,r)=>e in t?nl(t,e,{enumerable:!0,configurable:!0,writable:!0,value:r}):t[e]=r;var Q=(t,e)=>()=>(e||t((e={exports:{}}).exports,e),e.exports),Ai=(t,e)=>{for(var r in e)nl(t,r,{get:e[r],enumerable:!0})},Ku=(t,e,r,n)=>{if(e&&typeof e=="object"||typeof e=="function")for(let i of Pb(e))!Fb.call(t,i)&&i!==r&&nl(t,i,{get:()=>e[i],enumerable:!(n=$b(e,i))||n.enumerable});return t},De=(t,e,r)=>(Ku(t,e,"default"),r&&Ku(r,e,"default")),yt=(t,e,r)=>(r=t!=null?wb(Mb(t)):{},Ku(e||!t||!t.__esModule?nl(r,"default",{value:t,enumerable:!0}):r,t)),Vb=t=>Ku(nl({},"__esModule",{value:!0}),t);var Si=(t,e,r)=>(Ub(t,typeof e!="symbol"?e+"":e,r),r);var zu=Q(jt=>{"use strict";Object.defineProperty(jt,"__esModule",{value:!0});jt.thenable=jt.typedArray=jt.stringArray=jt.array=jt.func=jt.error=jt.number=jt.string=jt.boolean=void 0;function Bb(t){return t===!0||t===!1}jt.boolean=Bb;function A_(t){return typeof t=="string"||t instanceof String}jt.string=A_;function Wb(t){return typeof t=="number"||t instanceof Number}jt.number=Wb;function Gb(t){return t instanceof Error}jt.error=Gb;function S_(t){return typeof t=="function"}jt.func=S_;function D_(t){return Array.isArray(t)}jt.array=D_;function jb(t){return D_(t)&&t.every(e=>A_(e))}jt.stringArray=jb;function qb(t,e){return Array.isArray(t)&&t.every(e)}jt.typedArray=qb;function Hb(t){return t&&S_(t.then)}jt.thenable=Hb});var Ts=Q(gr=>{"use strict";Object.defineProperty(gr,"__esModule",{value:!0});gr.stringArray=gr.array=gr.func=gr.error=gr.number=gr.string=gr.boolean=void 0;function Kb(t){return t===!0||t===!1}gr.boolean=Kb;function C_(t){return typeof t=="string"||t instanceof String}gr.string=C_;function zb(t){return typeof t=="number"||t instanceof Number}gr.number=zb;function Yb(t){return t instanceof Error}gr.error=Yb;function Xb(t){return typeof t=="function"}gr.func=Xb;function b_(t){return Array.isArray(t)}gr.array=b_;function Jb(t){return b_(t)&&t.every(e=>C_(e))}gr.stringArray=Jb});var Em=Q(ue=>{"use strict";Object.defineProperty(ue,"__esModule",{value:!0});ue.Message=ue.NotificationType9=ue.NotificationType8=ue.NotificationType7=ue.NotificationType6=ue.NotificationType5=ue.NotificationType4=ue.NotificationType3=ue.NotificationType2=ue.NotificationType1=ue.NotificationType0=ue.NotificationType=ue.RequestType9=ue.RequestType8=ue.RequestType7=ue.RequestType6=ue.RequestType5=ue.RequestType4=ue.RequestType3=ue.RequestType2=ue.RequestType1=ue.RequestType=ue.RequestType0=ue.AbstractMessageSignature=ue.ParameterStructures=ue.ResponseError=ue.ErrorCodes=void 0;var To=Ts(),em;(function(t){t.ParseError=-32700,t.InvalidRequest=-32600,t.MethodNotFound=-32601,t.InvalidParams=-32602,t.InternalError=-32603,t.jsonrpcReservedErrorRangeStart=-32099,t.serverErrorStart=-32099,t.MessageWriteError=-32099,t.MessageReadError=-32098,t.PendingResponseRejected=-32097,t.ConnectionInactive=-32096,t.ServerNotInitialized=-32002,t.UnknownErrorCode=-32001,t.jsonrpcReservedErrorRangeEnd=-32e3,t.serverErrorEnd=-32e3})(em||(ue.ErrorCodes=em={}));var tm=class t extends Error{constructor(e,r,n){super(r),this.code=To.number(e)?e:em.UnknownErrorCode,this.data=n,Object.setPrototypeOf(this,t.prototype)}toJson(){let e={code:this.code,message:this.message};return this.data!==void 0&&(e.data=this.data),e}};ue.ResponseError=tm;var Mr=class t{constructor(e){this.kind=e}static is(e){return e===t.auto||e===t.byName||e===t.byPosition}toString(){return this.kind}};ue.ParameterStructures=Mr;Mr.auto=new Mr("auto");Mr.byPosition=new Mr("byPosition");Mr.byName=new Mr("byName");var ot=class{constructor(e,r){this.method=e,this.numberOfParams=r}get parameterStructures(){return Mr.auto}};ue.AbstractMessageSignature=ot;var rm=class extends ot{constructor(e){super(e,0)}};ue.RequestType0=rm;var nm=class extends ot{constructor(e,r=Mr.auto){super(e,1),this._parameterStructures=r}get parameterStructures(){return this._parameterStructures}};ue.RequestType=nm;var im=class extends ot{constructor(e,r=Mr.auto){super(e,1),this._parameterStructures=r}get parameterStructures(){return this._parameterStructures}};ue.RequestType1=im;var om=class extends ot{constructor(e){super(e,2)}};ue.RequestType2=om;var sm=class extends ot{constructor(e){super(e,3)}};ue.RequestType3=sm;var am=class extends ot{constructor(e){super(e,4)}};ue.RequestType4=am;var lm=class extends ot{constructor(e){super(e,5)}};ue.RequestType5=lm;var um=class extends ot{constructor(e){super(e,6)}};ue.RequestType6=um;var cm=class extends ot{constructor(e){super(e,7)}};ue.RequestType7=cm;var fm=class extends ot{constructor(e){super(e,8)}};ue.RequestType8=fm;var dm=class extends ot{constructor(e){super(e,9)}};ue.RequestType9=dm;var pm=class extends ot{constructor(e,r=Mr.auto){super(e,1),this._parameterStructures=r}get parameterStructures(){return this._parameterStructures}};ue.NotificationType=pm;var mm=class extends ot{constructor(e){super(e,0)}};ue.NotificationType0=mm;var hm=class extends ot{constructor(e,r=Mr.auto){super(e,1),this._parameterStructures=r}get parameterStructures(){return this._parameterStructures}};ue.NotificationType1=hm;var gm=class extends ot{constructor(e){super(e,2)}};ue.NotificationType2=gm;var Tm=class extends ot{constructor(e){super(e,3)}};ue.NotificationType3=Tm;var ym=class extends ot{constructor(e){super(e,4)}};ue.NotificationType4=ym;var _m=class extends ot{constructor(e){super(e,5)}};ue.NotificationType5=_m;var vm=class extends ot{constructor(e){super(e,6)}};ue.NotificationType6=vm;var Rm=class extends ot{constructor(e){super(e,7)}};ue.NotificationType7=Rm;var xm=class extends ot{constructor(e){super(e,8)}};ue.NotificationType8=xm;var Nm=class extends ot{constructor(e){super(e,9)}};ue.NotificationType9=Nm;var L_;(function(t){function e(i){let o=i;return o&&To.string(o.method)&&(To.string(o.id)||To.number(o.id))}t.isRequest=e;function r(i){let o=i;return o&&To.string(o.method)&&i.id===void 0}t.isNotification=r;function n(i){let o=i;return o&&(o.result!==void 0||!!o.error)&&(To.string(o.id)||To.number(o.id)||o.id===null)}t.isResponse=n})(L_||(ue.Message=L_={}))});var Om=Q(Di=>{"use strict";var k_;Object.defineProperty(Di,"__esModule",{value:!0});Di.LRUCache=Di.LinkedMap=Di.Touch=void 0;var Tr;(function(t){t.None=0,t.First=1,t.AsOld=t.First,t.Last=2,t.AsNew=t.Last})(Tr||(Di.Touch=Tr={}));var Yu=class{constructor(){this[k_]="LinkedMap",this._map=new Map,this._head=void 0,this._tail=void 0,this._size=0,this._state=0}clear(){this._map.clear(),this._head=void 0,this._tail=void 0,this._size=0,this._state++}isEmpty(){return!this._head&&!this._tail}get size(){return this._size}get first(){var e;return(e=this._head)==null?void 0:e.value}get last(){var e;return(e=this._tail)==null?void 0:e.value}has(e){return this._map.has(e)}get(e,r=Tr.None){let n=this._map.get(e);if(n)return r!==Tr.None&&this.touch(n,r),n.value}set(e,r,n=Tr.None){let i=this._map.get(e);if(i)i.value=r,n!==Tr.None&&this.touch(i,n);else{switch(i={key:e,value:r,next:void 0,previous:void 0},n){case Tr.None:this.addItemLast(i);break;case Tr.First:this.addItemFirst(i);break;case Tr.Last:this.addItemLast(i);break;default:this.addItemLast(i);break}this._map.set(e,i),this._size++}return this}delete(e){return!!this.remove(e)}remove(e){let r=this._map.get(e);if(r)return this._map.delete(e),this.removeItem(r),this._size--,r.value}shift(){if(!this._head&&!this._tail)return;if(!this._head||!this._tail)throw new Error("Invalid list");let e=this._head;return this._map.delete(e.key),this.removeItem(e),this._size--,e.value}forEach(e,r){let n=this._state,i=this._head;for(;i;){if(r?e.bind(r)(i.value,i.key,this):e(i.value,i.key,this),this._state!==n)throw new Error("LinkedMap got modified during iteration.");i=i.next}}keys(){let e=this._state,r=this._head,n={[Symbol.iterator]:()=>n,next:()=>{if(this._state!==e)throw new Error("LinkedMap got modified during iteration.");if(r){let i={value:r.key,done:!1};return r=r.next,i}else return{value:void 0,done:!0}}};return n}values(){let e=this._state,r=this._head,n={[Symbol.iterator]:()=>n,next:()=>{if(this._state!==e)throw new Error("LinkedMap got modified during iteration.");if(r){let i={value:r.value,done:!1};return r=r.next,i}else return{value:void 0,done:!0}}};return n}entries(){let e=this._state,r=this._head,n={[Symbol.iterator]:()=>n,next:()=>{if(this._state!==e)throw new Error("LinkedMap got modified during iteration.");if(r){let i={value:[r.key,r.value],done:!1};return r=r.next,i}else return{value:void 0,done:!0}}};return n}[(k_=Symbol.toStringTag,Symbol.iterator)](){return this.entries()}trimOld(e){if(e>=this.size)return;if(e===0){this.clear();return}let r=this._head,n=this.size;for(;r&&n>e;)this._map.delete(r.key),r=r.next,n--;this._head=r,this._size=n,r&&(r.previous=void 0),this._state++}addItemFirst(e){if(!this._head&&!this._tail)this._tail=e;else if(this._head)e.next=this._head,this._head.previous=e;else throw new Error("Invalid list");this._head=e,this._state++}addItemLast(e){if(!this._head&&!this._tail)this._head=e;else if(this._tail)e.previous=this._tail,this._tail.next=e;else throw new Error("Invalid list");this._tail=e,this._state++}removeItem(e){if(e===this._head&&e===this._tail)this._head=void 0,this._tail=void 0;else if(e===this._head){if(!e.next)throw new Error("Invalid list");e.next.previous=void 0,this._head=e.next}else if(e===this._tail){if(!e.previous)throw new Error("Invalid list");e.previous.next=void 0,this._tail=e.previous}else{let r=e.next,n=e.previous;if(!r||!n)throw new Error("Invalid list");r.previous=n,n.next=r}e.next=void 0,e.previous=void 0,this._state++}touch(e,r){if(!this._head||!this._tail)throw new Error("Invalid list");if(!(r!==Tr.First&&r!==Tr.Last)){if(r===Tr.First){if(e===this._head)return;let n=e.next,i=e.previous;e===this._tail?(i.next=void 0,this._tail=i):(n.previous=i,i.next=n),e.previous=void 0,e.next=this._head,this._head.previous=e,this._head=e,this._state++}else if(r===Tr.Last){if(e===this._tail)return;let n=e.next,i=e.previous;e===this._head?(n.previous=void 0,this._head=n):(n.previous=i,i.next=n),e.next=void 0,e.previous=this._tail,this._tail.next=e,this._tail=e,this._state++}}}toJSON(){let e=[];return this.forEach((r,n)=>{e.push([n,r])}),e}fromJSON(e){this.clear();for(let[r,n]of e)this.set(r,n)}};Di.LinkedMap=Yu;var Im=class extends Yu{constructor(e,r=1){super(),this._limit=e,this._ratio=Math.min(Math.max(0,r),1)}get limit(){return this._limit}set limit(e){this._limit=e,this.checkTrim()}get ratio(){return this._ratio}set ratio(e){this._ratio=Math.min(Math.max(0,e),1),this.checkTrim()}get(e,r=Tr.AsNew){return super.get(e,r)}peek(e){return super.get(e,Tr.None)}set(e,r){return super.set(e,r,Tr.Last),this.checkTrim(),this}checkTrim(){this.size>this._limit&&this.trimOld(Math.round(this._limit*this._ratio))}};Di.LRUCache=Im});var $_=Q(Xu=>{"use strict";Object.defineProperty(Xu,"__esModule",{value:!0});Xu.Disposable=void 0;var w_;(function(t){function e(r){return{dispose:r}}t.create=e})(w_||(Xu.Disposable=w_={}))});var Ci=Q(Dm=>{"use strict";Object.defineProperty(Dm,"__esModule",{value:!0});var Am;function Sm(){if(Am===void 0)throw new Error("No runtime abstraction layer installed");return Am}(function(t){function e(r){if(r===void 0)throw new Error("No runtime abstraction layer provided");Am=r}t.install=e})(Sm||(Sm={}));Dm.default=Sm});var _s=Q(ys=>{"use strict";Object.defineProperty(ys,"__esModule",{value:!0});ys.Emitter=ys.Event=void 0;var Qb=Ci(),P_;(function(t){let e={dispose(){}};t.None=function(){return e}})(P_||(ys.Event=P_={}));var Cm=class{add(e,r=null,n){this._callbacks||(this._callbacks=[],this._contexts=[]),this._callbacks.push(e),this._contexts.push(r),Array.isArray(n)&&n.push({dispose:()=>this.remove(e,r)})}remove(e,r=null){if(!this._callbacks)return;let n=!1;for(let i=0,o=this._callbacks.length;i<o;i++)if(this._callbacks[i]===e)if(this._contexts[i]===r){this._callbacks.splice(i,1),this._contexts.splice(i,1);return}else n=!0;if(n)throw new Error("When adding a listener with a context, you should remove it with the same context")}invoke(...e){if(!this._callbacks)return[];let r=[],n=this._callbacks.slice(0),i=this._contexts.slice(0);for(let o=0,s=n.length;o<s;o++)try{r.push(n[o].apply(i[o],e))}catch(a){(0,Qb.default)().console.error(a)}return r}isEmpty(){return!this._callbacks||this._callbacks.length===0}dispose(){this._callbacks=void 0,this._contexts=void 0}},Ju=class t{constructor(e){this._options=e}get event(){return this._event||(this._event=(e,r,n)=>{this._callbacks||(this._callbacks=new Cm),this._options&&this._options.onFirstListenerAdd&&this._callbacks.isEmpty()&&this._options.onFirstListenerAdd(this),this._callbacks.add(e,r);let i={dispose:()=>{this._callbacks&&(this._callbacks.remove(e,r),i.dispose=t._noop,this._options&&this._options.onLastListenerRemove&&this._callbacks.isEmpty()&&this._options.onLastListenerRemove(this))}};return Array.isArray(n)&&n.push(i),i}),this._event}fire(e){this._callbacks&&this._callbacks.invoke.call(this._callbacks,e)}dispose(){this._callbacks&&(this._callbacks.dispose(),this._callbacks=void 0)}};ys.Emitter=Ju;Ju._noop=function(){}});var ec=Q(vs=>{"use strict";Object.defineProperty(vs,"__esModule",{value:!0});vs.CancellationTokenSource=vs.CancellationToken=void 0;var Zb=Ci(),eL=Ts(),bm=_s(),Qu;(function(t){t.None=Object.freeze({isCancellationRequested:!1,onCancellationRequested:bm.Event.None}),t.Cancelled=Object.freeze({isCancellationRequested:!0,onCancellationRequested:bm.Event.None});function e(r){let n=r;return n&&(n===t.None||n===t.Cancelled||eL.boolean(n.isCancellationRequested)&&!!n.onCancellationRequested)}t.is=e})(Qu||(vs.CancellationToken=Qu={}));var tL=Object.freeze(function(t,e){let r=(0,Zb.default)().timer.setTimeout(t.bind(e),0);return{dispose(){r.dispose()}}}),Zu=class{constructor(){this._isCancelled=!1}cancel(){this._isCancelled||(this._isCancelled=!0,this._emitter&&(this._emitter.fire(void 0),this.dispose()))}get isCancellationRequested(){return this._isCancelled}get onCancellationRequested(){return this._isCancelled?tL:(this._emitter||(this._emitter=new bm.Emitter),this._emitter.event)}dispose(){this._emitter&&(this._emitter.dispose(),this._emitter=void 0)}},Lm=class{get token(){return this._token||(this._token=new Zu),this._token}cancel(){this._token?this._token.cancel():this._token=Qu.Cancelled}dispose(){this._token?this._token instanceof Zu&&this._token.dispose():this._token=Qu.None}};vs.CancellationTokenSource=Lm});var M_=Q(Rs=>{"use strict";Object.defineProperty(Rs,"__esModule",{value:!0});Rs.SharedArrayReceiverStrategy=Rs.SharedArraySenderStrategy=void 0;var rL=ec(),il;(function(t){t.Continue=0,t.Cancelled=1})(il||(il={}));var km=class{constructor(){this.buffers=new Map}enableCancellation(e){if(e.id===null)return;let r=new SharedArrayBuffer(4),n=new Int32Array(r,0,1);n[0]=il.Continue,this.buffers.set(e.id,r),e.$cancellationData=r}async sendCancellation(e,r){let n=this.buffers.get(r);if(n===void 0)return;let i=new Int32Array(n,0,1);Atomics.store(i,0,il.Cancelled)}cleanup(e){this.buffers.delete(e)}dispose(){this.buffers.clear()}};Rs.SharedArraySenderStrategy=km;var wm=class{constructor(e){this.data=new Int32Array(e,0,1)}get isCancellationRequested(){return Atomics.load(this.data,0)===il.Cancelled}get onCancellationRequested(){throw new Error("Cancellation over SharedArrayBuffer doesn't support cancellation events")}},$m=class{constructor(e){this.token=new wm(e)}cancel(){}dispose(){}},Pm=class{constructor(){this.kind="request"}createCancellationTokenSource(e){let r=e.$cancellationData;return r===void 0?new rL.CancellationTokenSource:new $m(r)}};Rs.SharedArrayReceiverStrategy=Pm});var Fm=Q(tc=>{"use strict";Object.defineProperty(tc,"__esModule",{value:!0});tc.Semaphore=void 0;var nL=Ci(),Mm=class{constructor(e=1){if(e<=0)throw new Error("Capacity must be greater than 0");this._capacity=e,this._active=0,this._waiting=[]}lock(e){return new Promise((r,n)=>{this._waiting.push({thunk:e,resolve:r,reject:n}),this.runNext()})}get active(){return this._active}runNext(){this._waiting.length===0||this._active===this._capacity||(0,nL.default)().timer.setImmediate(()=>this.doRunNext())}doRunNext(){if(this._waiting.length===0||this._active===this._capacity)return;let e=this._waiting.shift();if(this._active++,this._active>this._capacity)throw new Error("To many thunks active");try{let r=e.thunk();r instanceof Promise?r.then(n=>{this._active--,e.resolve(n),this.runNext()},n=>{this._active--,e.reject(n),this.runNext()}):(this._active--,e.resolve(r),this.runNext())}catch(r){this._active--,e.reject(r),this.runNext()}}};tc.Semaphore=Mm});var U_=Q(bi=>{"use strict";Object.defineProperty(bi,"__esModule",{value:!0});bi.ReadableStreamMessageReader=bi.AbstractMessageReader=bi.MessageReader=void 0;var Vm=Ci(),xs=Ts(),Um=_s(),iL=Fm(),F_;(function(t){function e(r){let n=r;return n&&xs.func(n.listen)&&xs.func(n.dispose)&&xs.func(n.onError)&&xs.func(n.onClose)&&xs.func(n.onPartialMessage)}t.is=e})(F_||(bi.MessageReader=F_={}));var rc=class{constructor(){this.errorEmitter=new Um.Emitter,this.closeEmitter=new Um.Emitter,this.partialMessageEmitter=new Um.Emitter}dispose(){this.errorEmitter.dispose(),this.closeEmitter.dispose()}get onError(){return this.errorEmitter.event}fireError(e){this.errorEmitter.fire(this.asError(e))}get onClose(){return this.closeEmitter.event}fireClose(){this.closeEmitter.fire(void 0)}get onPartialMessage(){return this.partialMessageEmitter.event}firePartialMessage(e){this.partialMessageEmitter.fire(e)}asError(e){return e instanceof Error?e:new Error(`Reader received error. Reason: ${xs.string(e.message)?e.message:"unknown"}`)}};bi.AbstractMessageReader=rc;var Bm;(function(t){function e(r){var u;let n,i,o,s=new Map,a,l=new Map;if(r===void 0||typeof r=="string")n=r!=null?r:"utf-8";else{if(n=(u=r.charset)!=null?u:"utf-8",r.contentDecoder!==void 0&&(o=r.contentDecoder,s.set(o.name,o)),r.contentDecoders!==void 0)for(let c of r.contentDecoders)s.set(c.name,c);if(r.contentTypeDecoder!==void 0&&(a=r.contentTypeDecoder,l.set(a.name,a)),r.contentTypeDecoders!==void 0)for(let c of r.contentTypeDecoders)l.set(c.name,c)}return a===void 0&&(a=(0,Vm.default)().applicationJson.decoder,l.set(a.name,a)),{charset:n,contentDecoder:o,contentDecoders:s,contentTypeDecoder:a,contentTypeDecoders:l}}t.fromOptions=e})(Bm||(Bm={}));var Wm=class extends rc{constructor(e,r){super(),this.readable=e,this.options=Bm.fromOptions(r),this.buffer=(0,Vm.default)().messageBuffer.create(this.options.charset),this._partialMessageTimeout=1e4,this.nextMessageLength=-1,this.messageToken=0,this.readSemaphore=new iL.Semaphore(1)}set partialMessageTimeout(e){this._partialMessageTimeout=e}get partialMessageTimeout(){return this._partialMessageTimeout}listen(e){this.nextMessageLength=-1,this.messageToken=0,this.partialMessageTimer=void 0,this.callback=e;let r=this.readable.onData(n=>{this.onData(n)});return this.readable.onError(n=>this.fireError(n)),this.readable.onClose(()=>this.fireClose()),r}onData(e){try{for(this.buffer.append(e);;){if(this.nextMessageLength===-1){let n=this.buffer.tryReadHeaders(!0);if(!n)return;let i=n.get("content-length");if(!i){this.fireError(new Error(`Header must provide a Content-Length property.
${JSON.stringify(Object.fromEntries(n))}`));return}let o=parseInt(i);if(isNaN(o)){this.fireError(new Error(`Content-Length value must be a number. Got ${i}`));return}this.nextMessageLength=o}let r=this.buffer.tryReadBody(this.nextMessageLength);if(r===void 0){this.setPartialMessageTimer();return}this.clearPartialMessageTimer(),this.nextMessageLength=-1,this.readSemaphore.lock(async()=>{let n=this.options.contentDecoder!==void 0?await this.options.contentDecoder.decode(r):r,i=await this.options.contentTypeDecoder.decode(n,this.options);this.callback(i)}).catch(n=>{this.fireError(n)})}}catch(r){this.fireError(r)}}clearPartialMessageTimer(){this.partialMessageTimer&&(this.partialMessageTimer.dispose(),this.partialMessageTimer=void 0)}setPartialMessageTimer(){this.clearPartialMessageTimer(),!(this._partialMessageTimeout<=0)&&(this.partialMessageTimer=(0,Vm.default)().timer.setTimeout((e,r)=>{this.partialMessageTimer=void 0,e===this.messageToken&&(this.firePartialMessage({messageToken:e,waitingTime:r}),this.setPartialMessageTimer())},this._partialMessageTimeout,this.messageToken,this._partialMessageTimeout))}};bi.ReadableStreamMessageReader=Wm});var j_=Q(Li=>{"use strict";Object.defineProperty(Li,"__esModule",{value:!0});Li.WriteableStreamMessageWriter=Li.AbstractMessageWriter=Li.MessageWriter=void 0;var V_=Ci(),ol=Ts(),oL=Fm(),B_=_s(),sL="Content-Length: ",W_=`\r
`,G_;(function(t){function e(r){let n=r;return n&&ol.func(n.dispose)&&ol.func(n.onClose)&&ol.func(n.onError)&&ol.func(n.write)}t.is=e})(G_||(Li.MessageWriter=G_={}));var nc=class{constructor(){this.errorEmitter=new B_.Emitter,this.closeEmitter=new B_.Emitter}dispose(){this.errorEmitter.dispose(),this.closeEmitter.dispose()}get onError(){return this.errorEmitter.event}fireError(e,r,n){this.errorEmitter.fire([this.asError(e),r,n])}get onClose(){return this.closeEmitter.event}fireClose(){this.closeEmitter.fire(void 0)}asError(e){return e instanceof Error?e:new Error(`Writer received error. Reason: ${ol.string(e.message)?e.message:"unknown"}`)}};Li.AbstractMessageWriter=nc;var Gm;(function(t){function e(r){var n,i;return r===void 0||typeof r=="string"?{charset:r!=null?r:"utf-8",contentTypeEncoder:(0,V_.default)().applicationJson.encoder}:{charset:(n=r.charset)!=null?n:"utf-8",contentEncoder:r.contentEncoder,contentTypeEncoder:(i=r.contentTypeEncoder)!=null?i:(0,V_.default)().applicationJson.encoder}}t.fromOptions=e})(Gm||(Gm={}));var jm=class extends nc{constructor(e,r){super(),this.writable=e,this.options=Gm.fromOptions(r),this.errorCount=0,this.writeSemaphore=new oL.Semaphore(1),this.writable.onError(n=>this.fireError(n)),this.writable.onClose(()=>this.fireClose())}async write(e){return this.writeSemaphore.lock(async()=>this.options.contentTypeEncoder.encode(e,this.options).then(n=>this.options.contentEncoder!==void 0?this.options.contentEncoder.encode(n):n).then(n=>{let i=[];return i.push(sL,n.byteLength.toString(),W_),i.push(W_),this.doWrite(e,i,n)},n=>{throw this.fireError(n),n}))}async doWrite(e,r,n){try{return await this.writable.write(r.join(""),"ascii"),this.writable.write(n)}catch(i){return this.handleError(i,e),Promise.reject(i)}}handleError(e,r){this.errorCount++,this.fireError(e,r,this.errorCount)}end(){this.writable.end()}};Li.WriteableStreamMessageWriter=jm});var q_=Q(ic=>{"use strict";Object.defineProperty(ic,"__esModule",{value:!0});ic.AbstractMessageBuffer=void 0;var aL=13,lL=10,uL=`\r
`,qm=class{constructor(e="utf-8"){this._encoding=e,this._chunks=[],this._totalLength=0}get encoding(){return this._encoding}append(e){let r=typeof e=="string"?this.fromString(e,this._encoding):e;this._chunks.push(r),this._totalLength+=r.byteLength}tryReadHeaders(e=!1){if(this._chunks.length===0)return;let r=0,n=0,i=0,o=0;e:for(;n<this._chunks.length;){let u=this._chunks[n];for(i=0;i<u.length;){switch(u[i]){case aL:switch(r){case 0:r=1;break;case 2:r=3;break;default:r=0}break;case lL:switch(r){case 1:r=2;break;case 3:r=4,i++;break e;default:r=0}break;default:r=0}i++}o+=u.byteLength,n++}if(r!==4)return;let s=this._read(o+i),a=new Map,l=this.toString(s,"ascii").split(uL);if(l.length<2)return a;for(let u=0;u<l.length-2;u++){let c=l[u],f=c.indexOf(":");if(f===-1)throw new Error(`Message header must separate key and value using ':'
${c}`);let d=c.substr(0,f),m=c.substr(f+1).trim();a.set(e?d.toLowerCase():d,m)}return a}tryReadBody(e){if(!(this._totalLength<e))return this._read(e)}get numberOfBytes(){return this._totalLength}_read(e){if(e===0)return this.emptyBuffer();if(e>this._totalLength)throw new Error("Cannot read so many bytes!");if(this._chunks[0].byteLength===e){let o=this._chunks[0];return this._chunks.shift(),this._totalLength-=e,this.asNative(o)}if(this._chunks[0].byteLength>e){let o=this._chunks[0],s=this.asNative(o,e);return this._chunks[0]=o.slice(e),this._totalLength-=e,s}let r=this.allocNative(e),n=0,i=0;for(;e>0;){let o=this._chunks[i];if(o.byteLength>e){let s=o.slice(0,e);r.set(s,n),n+=e,this._chunks[i]=o.slice(e),this._totalLength-=e,e-=e}else r.set(o,n),n+=o.byteLength,this._chunks.shift(),this._totalLength-=o.byteLength,e-=o.byteLength}return r}};ic.AbstractMessageBuffer=qm});var X_=Q(ye=>{"use strict";Object.defineProperty(ye,"__esModule",{value:!0});ye.createMessageConnection=ye.ConnectionOptions=ye.MessageStrategy=ye.CancellationStrategy=ye.CancellationSenderStrategy=ye.CancellationReceiverStrategy=ye.RequestCancellationReceiverStrategy=ye.IdCancellationReceiverStrategy=ye.ConnectionStrategy=ye.ConnectionError=ye.ConnectionErrors=ye.LogTraceNotification=ye.SetTraceNotification=ye.TraceFormat=ye.TraceValues=ye.Trace=ye.NullLogger=ye.ProgressType=ye.ProgressToken=void 0;var H_=Ci(),_t=Ts(),de=Em(),K_=Om(),sl=_s(),Hm=ec(),ul;(function(t){t.type=new de.NotificationType("$/cancelRequest")})(ul||(ul={}));var Km;(function(t){function e(r){return typeof r=="string"||typeof r=="number"}t.is=e})(Km||(ye.ProgressToken=Km={}));var al;(function(t){t.type=new de.NotificationType("$/progress")})(al||(al={}));var zm=class{constructor(){}};ye.ProgressType=zm;var Ym;(function(t){function e(r){return _t.func(r)}t.is=e})(Ym||(Ym={}));ye.NullLogger=Object.freeze({error:()=>{},warn:()=>{},info:()=>{},log:()=>{}});var $e;(function(t){t[t.Off=0]="Off",t[t.Messages=1]="Messages",t[t.Compact=2]="Compact",t[t.Verbose=3]="Verbose"})($e||(ye.Trace=$e={}));var z_;(function(t){t.Off="off",t.Messages="messages",t.Compact="compact",t.Verbose="verbose"})(z_||(ye.TraceValues=z_={}));(function(t){function e(n){if(!_t.string(n))return t.Off;switch(n=n.toLowerCase(),n){case"off":return t.Off;case"messages":return t.Messages;case"compact":return t.Compact;case"verbose":return t.Verbose;default:return t.Off}}t.fromString=e;function r(n){switch(n){case t.Off:return"off";case t.Messages:return"messages";case t.Compact:return"compact";case t.Verbose:return"verbose";default:return"off"}}t.toString=r})($e||(ye.Trace=$e={}));var Zr;(function(t){t.Text="text",t.JSON="json"})(Zr||(ye.TraceFormat=Zr={}));(function(t){function e(r){return _t.string(r)?(r=r.toLowerCase(),r==="json"?t.JSON:t.Text):t.Text}t.fromString=e})(Zr||(ye.TraceFormat=Zr={}));var Xm;(function(t){t.type=new de.NotificationType("$/setTrace")})(Xm||(ye.SetTraceNotification=Xm={}));var oc;(function(t){t.type=new de.NotificationType("$/logTrace")})(oc||(ye.LogTraceNotification=oc={}));var ll;(function(t){t[t.Closed=1]="Closed",t[t.Disposed=2]="Disposed",t[t.AlreadyListening=3]="AlreadyListening"})(ll||(ye.ConnectionErrors=ll={}));var Ns=class t extends Error{constructor(e,r){super(r),this.code=e,Object.setPrototypeOf(this,t.prototype)}};ye.ConnectionError=Ns;var Jm;(function(t){function e(r){let n=r;return n&&_t.func(n.cancelUndispatched)}t.is=e})(Jm||(ye.ConnectionStrategy=Jm={}));var sc;(function(t){function e(r){let n=r;return n&&(n.kind===void 0||n.kind==="id")&&_t.func(n.createCancellationTokenSource)&&(n.dispose===void 0||_t.func(n.dispose))}t.is=e})(sc||(ye.IdCancellationReceiverStrategy=sc={}));var Qm;(function(t){function e(r){let n=r;return n&&n.kind==="request"&&_t.func(n.createCancellationTokenSource)&&(n.dispose===void 0||_t.func(n.dispose))}t.is=e})(Qm||(ye.RequestCancellationReceiverStrategy=Qm={}));var ac;(function(t){t.Message=Object.freeze({createCancellationTokenSource(r){return new Hm.CancellationTokenSource}});function e(r){return sc.is(r)||Qm.is(r)}t.is=e})(ac||(ye.CancellationReceiverStrategy=ac={}));var lc;(function(t){t.Message=Object.freeze({sendCancellation(r,n){return r.sendNotification(ul.type,{id:n})},cleanup(r){}});function e(r){let n=r;return n&&_t.func(n.sendCancellation)&&_t.func(n.cleanup)}t.is=e})(lc||(ye.CancellationSenderStrategy=lc={}));var uc;(function(t){t.Message=Object.freeze({receiver:ac.Message,sender:lc.Message});function e(r){let n=r;return n&&ac.is(n.receiver)&&lc.is(n.sender)}t.is=e})(uc||(ye.CancellationStrategy=uc={}));var cc;(function(t){function e(r){let n=r;return n&&_t.func(n.handleMessage)}t.is=e})(cc||(ye.MessageStrategy=cc={}));var Y_;(function(t){function e(r){let n=r;return n&&(uc.is(n.cancellationStrategy)||Jm.is(n.connectionStrategy)||cc.is(n.messageStrategy))}t.is=e})(Y_||(ye.ConnectionOptions=Y_={}));var vn;(function(t){t[t.New=1]="New",t[t.Listening=2]="Listening",t[t.Closed=3]="Closed",t[t.Disposed=4]="Disposed"})(vn||(vn={}));function cL(t,e,r,n){let i=r!==void 0?r:ye.NullLogger,o=0,s=0,a=0,l="2.0",u,c=new Map,f,d=new Map,m=new Map,_,x=new K_.LinkedMap,A=new Map,I=new Set,y=new Map,g=$e.Off,O=Zr.Text,M,J=vn.New,ce=new sl.Emitter,_e=new sl.Emitter,je=new sl.Emitter,Ce=new sl.Emitter,j=new sl.Emitter,k=n&&n.cancellationStrategy?n.cancellationStrategy:uc.Message;function V(R){if(R===null)throw new Error("Can't send requests with id null since the response can't be correlated.");return"req-"+R.toString()}function G(R){return R===null?"res-unknown-"+(++a).toString():"res-"+R.toString()}function ie(){return"not-"+(++s).toString()}function z(R,L){de.Message.isRequest(L)?R.set(V(L.id),L):de.Message.isResponse(L)?R.set(G(L.id),L):R.set(ie(),L)}function $(R){}function w(){return J===vn.Listening}function le(){return J===vn.Closed}function he(){return J===vn.Disposed}function Se(){(J===vn.New||J===vn.Listening)&&(J=vn.Closed,_e.fire(void 0))}function ar(R){ce.fire([R,void 0,void 0])}function Ii(R){ce.fire(R)}t.onClose(Se),t.onError(ar),e.onClose(Se),e.onError(Ii);function qe(){_||x.size===0||(_=(0,H_.default)().timer.setImmediate(()=>{_=void 0,ti()}))}function Xt(R){de.Message.isRequest(R)?Jt(R):de.Message.isNotification(R)?Mt(R):de.Message.isResponse(R)?Pt(R):gt(R)}function ti(){if(x.size===0)return;let R=x.shift();try{let L=n==null?void 0:n.messageStrategy;cc.is(L)?L.handleMessage(R,Xt):Xt(R)}finally{qe()}}let ht=R=>{try{if(de.Message.isNotification(R)&&R.method===ul.type.method){let L=R.params.id,U=V(L),B=x.get(U);if(de.Message.isRequest(B)){let ne=n==null?void 0:n.connectionStrategy,xe=ne&&ne.cancelUndispatched?ne.cancelUndispatched(B,$):void 0;if(xe&&(xe.error!==void 0||xe.result!==void 0)){x.delete(U),y.delete(L),xe.id=B.id,Jr(xe,R.method,Date.now()),e.write(xe).catch(()=>i.error("Sending response for canceled message failed."));return}}let oe=y.get(L);if(oe!==void 0){oe.cancel(),Oi(R);return}else I.add(L)}z(x,R)}finally{qe()}};function Jt(R){var Ft;if(he())return;function L(be,ut,Ve){let ct={jsonrpc:l,id:R.id};be instanceof de.ResponseError?ct.error=be.toJson():ct.result=be===void 0?null:be,Jr(ct,ut,Ve),e.write(ct).catch(()=>i.error("Sending response failed."))}function U(be,ut,Ve){let ct={jsonrpc:l,id:R.id,error:be.toJson()};Jr(ct,ut,Ve),e.write(ct).catch(()=>i.error("Sending response failed."))}function B(be,ut,Ve){be===void 0&&(be=null);let ct={jsonrpc:l,id:R.id,result:be};Jr(ct,ut,Ve),e.write(ct).catch(()=>i.error("Sending response failed."))}ri(R);let oe=c.get(R.method),ne,xe;oe&&(ne=oe.type,xe=oe.handler);let He=Date.now();if(xe||u){let be=(Ft=R.id)!=null?Ft:String(Date.now()),ut=sc.is(k.receiver)?k.receiver.createCancellationTokenSource(be):k.receiver.createCancellationTokenSource(R);R.id!==null&&I.has(R.id)&&ut.cancel(),R.id!==null&&y.set(be,ut);try{let Ve;if(xe)if(R.params===void 0){if(ne!==void 0&&ne.numberOfParams!==0){U(new de.ResponseError(de.ErrorCodes.InvalidParams,`Request ${R.method} defines ${ne.numberOfParams} params but received none.`),R.method,He);return}Ve=xe(ut.token)}else if(Array.isArray(R.params)){if(ne!==void 0&&ne.parameterStructures===de.ParameterStructures.byName){U(new de.ResponseError(de.ErrorCodes.InvalidParams,`Request ${R.method} defines parameters by name but received parameters by position`),R.method,He);return}Ve=xe(...R.params,ut.token)}else{if(ne!==void 0&&ne.parameterStructures===de.ParameterStructures.byPosition){U(new de.ResponseError(de.ErrorCodes.InvalidParams,`Request ${R.method} defines parameters by position but received parameters by name`),R.method,He);return}Ve=xe(R.params,ut.token)}else u&&(Ve=u(R.method,R.params,ut.token));let ct=Ve;Ve?ct.then?ct.then(Ut=>{y.delete(be),L(Ut,R.method,He)},Ut=>{y.delete(be),Ut instanceof de.ResponseError?U(Ut,R.method,He):Ut&&_t.string(Ut.message)?U(new de.ResponseError(de.ErrorCodes.InternalError,`Request ${R.method} failed with message: ${Ut.message}`),R.method,He):U(new de.ResponseError(de.ErrorCodes.InternalError,`Request ${R.method} failed unexpectedly without providing any details.`),R.method,He)}):(y.delete(be),L(Ve,R.method,He)):(y.delete(be),B(Ve,R.method,He))}catch(Ve){y.delete(be),Ve instanceof de.ResponseError?L(Ve,R.method,He):Ve&&_t.string(Ve.message)?U(new de.ResponseError(de.ErrorCodes.InternalError,`Request ${R.method} failed with message: ${Ve.message}`),R.method,He):U(new de.ResponseError(de.ErrorCodes.InternalError,`Request ${R.method} failed unexpectedly without providing any details.`),R.method,He)}}else U(new de.ResponseError(de.ErrorCodes.MethodNotFound,`Unhandled method ${R.method}`),R.method,He)}function Pt(R){if(!he())if(R.id===null)R.error?i.error(`Received response message without id: Error is: 
${JSON.stringify(R.error,void 0,4)}`):i.error("Received response message without id. No further error information provided.");else{let L=R.id,U=A.get(L);if(ps(R,U),U!==void 0){A.delete(L);try{if(R.error){let B=R.error;U.reject(new de.ResponseError(B.code,B.message,B.data))}else if(R.result!==void 0)U.resolve(R.result);else throw new Error("Should never happen.")}catch(B){B.message?i.error(`Response handler '${U.method}' failed with message: ${B.message}`):i.error(`Response handler '${U.method}' failed unexpectedly.`)}}}}function Mt(R){if(he())return;let L,U;if(R.method===ul.type.method){let B=R.params.id;I.delete(B),Oi(R);return}else{let B=d.get(R.method);B&&(U=B.handler,L=B.type)}if(U||f)try{if(Oi(R),U)if(R.params===void 0)L!==void 0&&L.numberOfParams!==0&&L.parameterStructures!==de.ParameterStructures.byName&&i.error(`Notification ${R.method} defines ${L.numberOfParams} params but received none.`),U();else if(Array.isArray(R.params)){let B=R.params;R.method===al.type.method&&B.length===2&&Km.is(B[0])?U({token:B[0],value:B[1]}):(L!==void 0&&(L.parameterStructures===de.ParameterStructures.byName&&i.error(`Notification ${R.method} defines parameters by name but received parameters by position`),L.numberOfParams!==R.params.length&&i.error(`Notification ${R.method} defines ${L.numberOfParams} params but received ${B.length} arguments`)),U(...B))}else L!==void 0&&L.parameterStructures===de.ParameterStructures.byPosition&&i.error(`Notification ${R.method} defines parameters by position but received parameters by name`),U(R.params);else f&&f(R.method,R.params)}catch(B){B.message?i.error(`Notification handler '${R.method}' failed with message: ${B.message}`):i.error(`Notification handler '${R.method}' failed unexpectedly.`)}else je.fire(R)}function gt(R){if(!R){i.error("Received empty message.");return}i.error(`Received message which is neither a response nor a notification message:
${JSON.stringify(R,null,4)}`);let L=R;if(_t.string(L.id)||_t.number(L.id)){let U=L.id,B=A.get(U);B&&B.reject(new Error("The received response has neither a result nor an error property."))}}function Tt(R){if(R!=null)switch(g){case $e.Verbose:return JSON.stringify(R,null,4);case $e.Compact:return JSON.stringify(R);default:return}}function hr(R){if(!(g===$e.Off||!M))if(O===Zr.Text){let L;(g===$e.Verbose||g===$e.Compact)&&R.params&&(L=`Params: ${Tt(R.params)}

`),M.log(`Sending request '${R.method} - (${R.id})'.`,L)}else Qr("send-request",R)}function Ir(R){if(!(g===$e.Off||!M))if(O===Zr.Text){let L;(g===$e.Verbose||g===$e.Compact)&&(R.params?L=`Params: ${Tt(R.params)}

`:L=`No parameters provided.

`),M.log(`Sending notification '${R.method}'.`,L)}else Qr("send-notification",R)}function Jr(R,L,U){if(!(g===$e.Off||!M))if(O===Zr.Text){let B;(g===$e.Verbose||g===$e.Compact)&&(R.error&&R.error.data?B=`Error data: ${Tt(R.error.data)}

`:R.result?B=`Result: ${Tt(R.result)}

`:R.error===void 0&&(B=`No result returned.

`)),M.log(`Sending response '${L} - (${R.id})'. Processing request took ${Date.now()-U}ms`,B)}else Qr("send-response",R)}function ri(R){if(!(g===$e.Off||!M))if(O===Zr.Text){let L;(g===$e.Verbose||g===$e.Compact)&&R.params&&(L=`Params: ${Tt(R.params)}

`),M.log(`Received request '${R.method} - (${R.id})'.`,L)}else Qr("receive-request",R)}function Oi(R){if(!(g===$e.Off||!M||R.method===oc.type.method))if(O===Zr.Text){let L;(g===$e.Verbose||g===$e.Compact)&&(R.params?L=`Params: ${Tt(R.params)}

`:L=`No parameters provided.

`),M.log(`Received notification '${R.method}'.`,L)}else Qr("receive-notification",R)}function ps(R,L){if(!(g===$e.Off||!M))if(O===Zr.Text){let U;if((g===$e.Verbose||g===$e.Compact)&&(R.error&&R.error.data?U=`Error data: ${Tt(R.error.data)}

`:R.result?U=`Result: ${Tt(R.result)}

`:R.error===void 0&&(U=`No result returned.

`)),L){let B=R.error?` Request failed: ${R.error.message} (${R.error.code}).`:"";M.log(`Received response '${L.method} - (${R.id})' in ${Date.now()-L.timerStart}ms.${B}`,U)}else M.log(`Received response ${R.id} without active response promise.`,U)}else Qr("receive-response",R)}function Qr(R,L){if(!M||g===$e.Off)return;let U={isLSPMessage:!0,type:R,message:L,timestamp:Date.now()};M.log(U)}function wn(){if(le())throw new Ns(ll.Closed,"Connection is closed.");if(he())throw new Ns(ll.Disposed,"Connection is disposed.")}function ms(){if(w())throw new Ns(ll.AlreadyListening,"Connection is already listening")}function hs(){if(!w())throw new Error("Call listen() first.")}function Pr(R){return R===void 0?null:R}function D(R){if(R!==null)return R}function F(R){return R!=null&&!Array.isArray(R)&&typeof R=="object"}function q(R,L){switch(R){case de.ParameterStructures.auto:return F(L)?D(L):[Pr(L)];case de.ParameterStructures.byName:if(!F(L))throw new Error("Received parameters by name but param is not an object literal.");return D(L);case de.ParameterStructures.byPosition:return[Pr(L)];default:throw new Error(`Unknown parameter structure ${R.toString()}`)}}function Y(R,L){let U,B=R.numberOfParams;switch(B){case 0:U=void 0;break;case 1:U=q(R.parameterStructures,L[0]);break;default:U=[];for(let oe=0;oe<L.length&&oe<B;oe++)U.push(Pr(L[oe]));if(L.length<B)for(let oe=L.length;oe<B;oe++)U.push(null);break}return U}let ee={sendNotification:(R,...L)=>{wn();let U,B;if(_t.string(R)){U=R;let ne=L[0],xe=0,He=de.ParameterStructures.auto;de.ParameterStructures.is(ne)&&(xe=1,He=ne);let Ft=L.length,be=Ft-xe;switch(be){case 0:B=void 0;break;case 1:B=q(He,L[xe]);break;default:if(He===de.ParameterStructures.byName)throw new Error(`Received ${be} parameters for 'by Name' notification parameter structure.`);B=L.slice(xe,Ft).map(ut=>Pr(ut));break}}else{let ne=L;U=R.method,B=Y(R,ne)}let oe={jsonrpc:l,method:U,params:B};return Ir(oe),e.write(oe).catch(ne=>{throw i.error("Sending notification failed."),ne})},onNotification:(R,L)=>{wn();let U;return _t.func(R)?f=R:L&&(_t.string(R)?(U=R,d.set(R,{type:void 0,handler:L})):(U=R.method,d.set(R.method,{type:R,handler:L}))),{dispose:()=>{U!==void 0?d.delete(U):f=void 0}}},onProgress:(R,L,U)=>{if(m.has(L))throw new Error(`Progress handler for token ${L} already registered`);return m.set(L,U),{dispose:()=>{m.delete(L)}}},sendProgress:(R,L,U)=>ee.sendNotification(al.type,{token:L,value:U}),onUnhandledProgress:Ce.event,sendRequest:(R,...L)=>{wn(),hs();let U,B,oe;if(_t.string(R)){U=R;let Ft=L[0],be=L[L.length-1],ut=0,Ve=de.ParameterStructures.auto;de.ParameterStructures.is(Ft)&&(ut=1,Ve=Ft);let ct=L.length;Hm.CancellationToken.is(be)&&(ct=ct-1,oe=be);let Ut=ct-ut;switch(Ut){case 0:B=void 0;break;case 1:B=q(Ve,L[ut]);break;default:if(Ve===de.ParameterStructures.byName)throw new Error(`Received ${Ut} parameters for 'by Name' request parameter structure.`);B=L.slice(ut,ct).map(qu=>Pr(qu));break}}else{let Ft=L;U=R.method,B=Y(R,Ft);let be=R.numberOfParams;oe=Hm.CancellationToken.is(Ft[be])?Ft[be]:void 0}let ne=o++,xe;oe&&(xe=oe.onCancellationRequested(()=>{let Ft=k.sender.sendCancellation(ee,ne);return Ft===void 0?(i.log(`Received no promise from cancellation strategy when cancelling id ${ne}`),Promise.resolve()):Ft.catch(()=>{i.log(`Sending cancellation messages for id ${ne} failed`)})}));let He={jsonrpc:l,id:ne,method:U,params:B};return hr(He),typeof k.sender.enableCancellation=="function"&&k.sender.enableCancellation(He),new Promise(async(Ft,be)=>{let ut=Ut=>{Ft(Ut),k.sender.cleanup(ne),xe==null||xe.dispose()},Ve=Ut=>{be(Ut),k.sender.cleanup(ne),xe==null||xe.dispose()},ct={method:U,timerStart:Date.now(),resolve:ut,reject:Ve};try{await e.write(He),A.set(ne,ct)}catch(Ut){throw i.error("Sending request failed."),ct.reject(new de.ResponseError(de.ErrorCodes.MessageWriteError,Ut.message?Ut.message:"Unknown reason")),Ut}})},onRequest:(R,L)=>{wn();let U=null;return Ym.is(R)?(U=void 0,u=R):_t.string(R)?(U=null,L!==void 0&&(U=R,c.set(R,{handler:L,type:void 0}))):L!==void 0&&(U=R.method,c.set(R.method,{type:R,handler:L})),{dispose:()=>{U!==null&&(U!==void 0?c.delete(U):u=void 0)}}},hasPendingResponse:()=>A.size>0,trace:async(R,L,U)=>{let B=!1,oe=Zr.Text;U!==void 0&&(_t.boolean(U)?B=U:(B=U.sendNotification||!1,oe=U.traceFormat||Zr.Text)),g=R,O=oe,g===$e.Off?M=void 0:M=L,B&&!le()&&!he()&&await ee.sendNotification(Xm.type,{value:$e.toString(R)})},onError:ce.event,onClose:_e.event,onUnhandledNotification:je.event,onDispose:j.event,end:()=>{e.end()},dispose:()=>{if(he())return;J=vn.Disposed,j.fire(void 0);let R=new de.ResponseError(de.ErrorCodes.PendingResponseRejected,"Pending response rejected since connection got disposed");for(let L of A.values())L.reject(R);A=new Map,y=new Map,I=new Set,x=new K_.LinkedMap,_t.func(e.dispose)&&e.dispose(),_t.func(t.dispose)&&t.dispose()},listen:()=>{wn(),ms(),J=vn.Listening,t.listen(ht)},inspect:()=>{(0,H_.default)().console.log("inspect")}};return ee.onNotification(oc.type,R=>{if(g===$e.Off||!M)return;let L=g===$e.Verbose||g===$e.Compact;M.log(R.message,L?R.verbose:void 0)}),ee.onNotification(al.type,R=>{let L=m.get(R.token);L?L(R.value):Ce.fire(R)}),ee}ye.createMessageConnection=cL});var fc=Q(P=>{"use strict";Object.defineProperty(P,"__esModule",{value:!0});P.ProgressType=P.ProgressToken=P.createMessageConnection=P.NullLogger=P.ConnectionOptions=P.ConnectionStrategy=P.AbstractMessageBuffer=P.WriteableStreamMessageWriter=P.AbstractMessageWriter=P.MessageWriter=P.ReadableStreamMessageReader=P.AbstractMessageReader=P.MessageReader=P.SharedArrayReceiverStrategy=P.SharedArraySenderStrategy=P.CancellationToken=P.CancellationTokenSource=P.Emitter=P.Event=P.Disposable=P.LRUCache=P.Touch=P.LinkedMap=P.ParameterStructures=P.NotificationType9=P.NotificationType8=P.NotificationType7=P.NotificationType6=P.NotificationType5=P.NotificationType4=P.NotificationType3=P.NotificationType2=P.NotificationType1=P.NotificationType0=P.NotificationType=P.ErrorCodes=P.ResponseError=P.RequestType9=P.RequestType8=P.RequestType7=P.RequestType6=P.RequestType5=P.RequestType4=P.RequestType3=P.RequestType2=P.RequestType1=P.RequestType0=P.RequestType=P.Message=P.RAL=void 0;P.MessageStrategy=P.CancellationStrategy=P.CancellationSenderStrategy=P.CancellationReceiverStrategy=P.ConnectionError=P.ConnectionErrors=P.LogTraceNotification=P.SetTraceNotification=P.TraceFormat=P.TraceValues=P.Trace=void 0;var Qe=Em();Object.defineProperty(P,"Message",{enumerable:!0,get:function(){return Qe.Message}});Object.defineProperty(P,"RequestType",{enumerable:!0,get:function(){return Qe.RequestType}});Object.defineProperty(P,"RequestType0",{enumerable:!0,get:function(){return Qe.RequestType0}});Object.defineProperty(P,"RequestType1",{enumerable:!0,get:function(){return Qe.RequestType1}});Object.defineProperty(P,"RequestType2",{enumerable:!0,get:function(){return Qe.RequestType2}});Object.defineProperty(P,"RequestType3",{enumerable:!0,get:function(){return Qe.RequestType3}});Object.defineProperty(P,"RequestType4",{enumerable:!0,get:function(){return Qe.RequestType4}});Object.defineProperty(P,"RequestType5",{enumerable:!0,get:function(){return Qe.RequestType5}});Object.defineProperty(P,"RequestType6",{enumerable:!0,get:function(){return Qe.RequestType6}});Object.defineProperty(P,"RequestType7",{enumerable:!0,get:function(){return Qe.RequestType7}});Object.defineProperty(P,"RequestType8",{enumerable:!0,get:function(){return Qe.RequestType8}});Object.defineProperty(P,"RequestType9",{enumerable:!0,get:function(){return Qe.RequestType9}});Object.defineProperty(P,"ResponseError",{enumerable:!0,get:function(){return Qe.ResponseError}});Object.defineProperty(P,"ErrorCodes",{enumerable:!0,get:function(){return Qe.ErrorCodes}});Object.defineProperty(P,"NotificationType",{enumerable:!0,get:function(){return Qe.NotificationType}});Object.defineProperty(P,"NotificationType0",{enumerable:!0,get:function(){return Qe.NotificationType0}});Object.defineProperty(P,"NotificationType1",{enumerable:!0,get:function(){return Qe.NotificationType1}});Object.defineProperty(P,"NotificationType2",{enumerable:!0,get:function(){return Qe.NotificationType2}});Object.defineProperty(P,"NotificationType3",{enumerable:!0,get:function(){return Qe.NotificationType3}});Object.defineProperty(P,"NotificationType4",{enumerable:!0,get:function(){return Qe.NotificationType4}});Object.defineProperty(P,"NotificationType5",{enumerable:!0,get:function(){return Qe.NotificationType5}});Object.defineProperty(P,"NotificationType6",{enumerable:!0,get:function(){return Qe.NotificationType6}});Object.defineProperty(P,"NotificationType7",{enumerable:!0,get:function(){return Qe.NotificationType7}});Object.defineProperty(P,"NotificationType8",{enumerable:!0,get:function(){return Qe.NotificationType8}});Object.defineProperty(P,"NotificationType9",{enumerable:!0,get:function(){return Qe.NotificationType9}});Object.defineProperty(P,"ParameterStructures",{enumerable:!0,get:function(){return Qe.ParameterStructures}});var Zm=Om();Object.defineProperty(P,"LinkedMap",{enumerable:!0,get:function(){return Zm.LinkedMap}});Object.defineProperty(P,"LRUCache",{enumerable:!0,get:function(){return Zm.LRUCache}});Object.defineProperty(P,"Touch",{enumerable:!0,get:function(){return Zm.Touch}});var fL=$_();Object.defineProperty(P,"Disposable",{enumerable:!0,get:function(){return fL.Disposable}});var J_=_s();Object.defineProperty(P,"Event",{enumerable:!0,get:function(){return J_.Event}});Object.defineProperty(P,"Emitter",{enumerable:!0,get:function(){return J_.Emitter}});var Q_=ec();Object.defineProperty(P,"CancellationTokenSource",{enumerable:!0,get:function(){return Q_.CancellationTokenSource}});Object.defineProperty(P,"CancellationToken",{enumerable:!0,get:function(){return Q_.CancellationToken}});var Z_=M_();Object.defineProperty(P,"SharedArraySenderStrategy",{enumerable:!0,get:function(){return Z_.SharedArraySenderStrategy}});Object.defineProperty(P,"SharedArrayReceiverStrategy",{enumerable:!0,get:function(){return Z_.SharedArrayReceiverStrategy}});var eh=U_();Object.defineProperty(P,"MessageReader",{enumerable:!0,get:function(){return eh.MessageReader}});Object.defineProperty(P,"AbstractMessageReader",{enumerable:!0,get:function(){return eh.AbstractMessageReader}});Object.defineProperty(P,"ReadableStreamMessageReader",{enumerable:!0,get:function(){return eh.ReadableStreamMessageReader}});var th=j_();Object.defineProperty(P,"MessageWriter",{enumerable:!0,get:function(){return th.MessageWriter}});Object.defineProperty(P,"AbstractMessageWriter",{enumerable:!0,get:function(){return th.AbstractMessageWriter}});Object.defineProperty(P,"WriteableStreamMessageWriter",{enumerable:!0,get:function(){return th.WriteableStreamMessageWriter}});var dL=q_();Object.defineProperty(P,"AbstractMessageBuffer",{enumerable:!0,get:function(){return dL.AbstractMessageBuffer}});var lr=X_();Object.defineProperty(P,"ConnectionStrategy",{enumerable:!0,get:function(){return lr.ConnectionStrategy}});Object.defineProperty(P,"ConnectionOptions",{enumerable:!0,get:function(){return lr.ConnectionOptions}});Object.defineProperty(P,"NullLogger",{enumerable:!0,get:function(){return lr.NullLogger}});Object.defineProperty(P,"createMessageConnection",{enumerable:!0,get:function(){return lr.createMessageConnection}});Object.defineProperty(P,"ProgressToken",{enumerable:!0,get:function(){return lr.ProgressToken}});Object.defineProperty(P,"ProgressType",{enumerable:!0,get:function(){return lr.ProgressType}});Object.defineProperty(P,"Trace",{enumerable:!0,get:function(){return lr.Trace}});Object.defineProperty(P,"TraceValues",{enumerable:!0,get:function(){return lr.TraceValues}});Object.defineProperty(P,"TraceFormat",{enumerable:!0,get:function(){return lr.TraceFormat}});Object.defineProperty(P,"SetTraceNotification",{enumerable:!0,get:function(){return lr.SetTraceNotification}});Object.defineProperty(P,"LogTraceNotification",{enumerable:!0,get:function(){return lr.LogTraceNotification}});Object.defineProperty(P,"ConnectionErrors",{enumerable:!0,get:function(){return lr.ConnectionErrors}});Object.defineProperty(P,"ConnectionError",{enumerable:!0,get:function(){return lr.ConnectionError}});Object.defineProperty(P,"CancellationReceiverStrategy",{enumerable:!0,get:function(){return lr.CancellationReceiverStrategy}});Object.defineProperty(P,"CancellationSenderStrategy",{enumerable:!0,get:function(){return lr.CancellationSenderStrategy}});Object.defineProperty(P,"CancellationStrategy",{enumerable:!0,get:function(){return lr.CancellationStrategy}});Object.defineProperty(P,"MessageStrategy",{enumerable:!0,get:function(){return lr.MessageStrategy}});var pL=Ci();P.RAL=pL.default});var rv=Q(oh=>{"use strict";Object.defineProperty(oh,"__esModule",{value:!0});var ev=require("util"),ii=fc(),dc=class t extends ii.AbstractMessageBuffer{constructor(e="utf-8"){super(e)}emptyBuffer(){return t.emptyBuffer}fromString(e,r){return Buffer.from(e,r)}toString(e,r){return e instanceof Buffer?e.toString(r):new ev.TextDecoder(r).decode(e)}asNative(e,r){return r===void 0?e instanceof Buffer?e:Buffer.from(e):e instanceof Buffer?e.slice(0,r):Buffer.from(e,0,r)}allocNative(e){return Buffer.allocUnsafe(e)}};dc.emptyBuffer=Buffer.allocUnsafe(0);var rh=class{constructor(e){this.stream=e}onClose(e){return this.stream.on("close",e),ii.Disposable.create(()=>this.stream.off("close",e))}onError(e){return this.stream.on("error",e),ii.Disposable.create(()=>this.stream.off("error",e))}onEnd(e){return this.stream.on("end",e),ii.Disposable.create(()=>this.stream.off("end",e))}onData(e){return this.stream.on("data",e),ii.Disposable.create(()=>this.stream.off("data",e))}},nh=class{constructor(e){this.stream=e}onClose(e){return this.stream.on("close",e),ii.Disposable.create(()=>this.stream.off("close",e))}onError(e){return this.stream.on("error",e),ii.Disposable.create(()=>this.stream.off("error",e))}onEnd(e){return this.stream.on("end",e),ii.Disposable.create(()=>this.stream.off("end",e))}write(e,r){return new Promise((n,i)=>{let o=s=>{s==null?n():i(s)};typeof e=="string"?this.stream.write(e,r,o):this.stream.write(e,o)})}end(){this.stream.end()}},tv=Object.freeze({messageBuffer:Object.freeze({create:t=>new dc(t)}),applicationJson:Object.freeze({encoder:Object.freeze({name:"application/json",encode:(t,e)=>{try{return Promise.resolve(Buffer.from(JSON.stringify(t,void 0,0),e.charset))}catch(r){return Promise.reject(r)}}}),decoder:Object.freeze({name:"application/json",decode:(t,e)=>{try{return t instanceof Buffer?Promise.resolve(JSON.parse(t.toString(e.charset))):Promise.resolve(JSON.parse(new ev.TextDecoder(e.charset).decode(t)))}catch(r){return Promise.reject(r)}}})}),stream:Object.freeze({asReadableStream:t=>new rh(t),asWritableStream:t=>new nh(t)}),console,timer:Object.freeze({setTimeout(t,e,...r){let n=setTimeout(t,e,...r);return{dispose:()=>clearTimeout(n)}},setImmediate(t,...e){let r=setImmediate(t,...e);return{dispose:()=>clearImmediate(r)}},setInterval(t,e,...r){let n=setInterval(t,e,...r);return{dispose:()=>clearInterval(n)}}})});function ih(){return tv}(function(t){function e(){ii.RAL.install(tv)}t.install=e})(ih||(ih={}));oh.default=ih});var vo=Q(Ie=>{"use strict";var mL=Ie&&Ie.__createBinding||(Object.create?function(t,e,r,n){n===void 0&&(n=r);var i=Object.getOwnPropertyDescriptor(e,r);(!i||("get"in i?!e.__esModule:i.writable||i.configurable))&&(i={enumerable:!0,get:function(){return e[r]}}),Object.defineProperty(t,n,i)}:function(t,e,r,n){n===void 0&&(n=r),t[n]=e[r]}),hL=Ie&&Ie.__exportStar||function(t,e){for(var r in t)r!=="default"&&!Object.prototype.hasOwnProperty.call(e,r)&&mL(e,t,r)};Object.defineProperty(Ie,"__esModule",{value:!0});Ie.createMessageConnection=Ie.createServerSocketTransport=Ie.createClientSocketTransport=Ie.createServerPipeTransport=Ie.createClientPipeTransport=Ie.generateRandomPipeName=Ie.StreamMessageWriter=Ie.StreamMessageReader=Ie.SocketMessageWriter=Ie.SocketMessageReader=Ie.PortMessageWriter=Ie.PortMessageReader=Ie.IPCMessageWriter=Ie.IPCMessageReader=void 0;var Es=rv();Es.default.install();var nv=require("path"),gL=require("os"),TL=require("crypto"),hc=require("net"),en=fc();hL(fc(),Ie);var sh=class extends en.AbstractMessageReader{constructor(e){super(),this.process=e;let r=this.process;r.on("error",n=>this.fireError(n)),r.on("close",()=>this.fireClose())}listen(e){return this.process.on("message",e),en.Disposable.create(()=>this.process.off("message",e))}};Ie.IPCMessageReader=sh;var ah=class extends en.AbstractMessageWriter{constructor(e){super(),this.process=e,this.errorCount=0;let r=this.process;r.on("error",n=>this.fireError(n)),r.on("close",()=>this.fireClose)}write(e){try{return typeof this.process.send=="function"&&this.process.send(e,void 0,void 0,r=>{r?(this.errorCount++,this.handleError(r,e)):this.errorCount=0}),Promise.resolve()}catch(r){return this.handleError(r,e),Promise.reject(r)}}handleError(e,r){this.errorCount++,this.fireError(e,r,this.errorCount)}end(){}};Ie.IPCMessageWriter=ah;var lh=class extends en.AbstractMessageReader{constructor(e){super(),this.onData=new en.Emitter,e.on("close",()=>this.fireClose),e.on("error",r=>this.fireError(r)),e.on("message",r=>{this.onData.fire(r)})}listen(e){return this.onData.event(e)}};Ie.PortMessageReader=lh;var uh=class extends en.AbstractMessageWriter{constructor(e){super(),this.port=e,this.errorCount=0,e.on("close",()=>this.fireClose()),e.on("error",r=>this.fireError(r))}write(e){try{return this.port.postMessage(e),Promise.resolve()}catch(r){return this.handleError(r,e),Promise.reject(r)}}handleError(e,r){this.errorCount++,this.fireError(e,r,this.errorCount)}end(){}};Ie.PortMessageWriter=uh;var yo=class extends en.ReadableStreamMessageReader{constructor(e,r="utf-8"){super((0,Es.default)().stream.asReadableStream(e),r)}};Ie.SocketMessageReader=yo;var _o=class extends en.WriteableStreamMessageWriter{constructor(e,r){super((0,Es.default)().stream.asWritableStream(e),r),this.socket=e}dispose(){super.dispose(),this.socket.destroy()}};Ie.SocketMessageWriter=_o;var pc=class extends en.ReadableStreamMessageReader{constructor(e,r){super((0,Es.default)().stream.asReadableStream(e),r)}};Ie.StreamMessageReader=pc;var mc=class extends en.WriteableStreamMessageWriter{constructor(e,r){super((0,Es.default)().stream.asWritableStream(e),r)}};Ie.StreamMessageWriter=mc;var iv=process.env.XDG_RUNTIME_DIR,yL=new Map([["linux",107],["darwin",103]]);function _L(){let t=(0,TL.randomBytes)(21).toString("hex");if(process.platform==="win32")return`\\\\.\\pipe\\vscode-jsonrpc-${t}-sock`;let e;iv?e=nv.join(iv,`vscode-ipc-${t}.sock`):e=nv.join(gL.tmpdir(),`vscode-${t}.sock`);let r=yL.get(process.platform);return r!==void 0&&e.length>r&&(0,Es.default)().console.warn(`WARNING: IPC handle "${e}" is longer than ${r} characters.`),e}Ie.generateRandomPipeName=_L;function vL(t,e="utf-8"){let r,n=new Promise((i,o)=>{r=i});return new Promise((i,o)=>{let s=(0,hc.createServer)(a=>{s.close(),r([new yo(a,e),new _o(a,e)])});s.on("error",o),s.listen(t,()=>{s.removeListener("error",o),i({onConnected:()=>n})})})}Ie.createClientPipeTransport=vL;function RL(t,e="utf-8"){let r=(0,hc.createConnection)(t);return[new yo(r,e),new _o(r,e)]}Ie.createServerPipeTransport=RL;function xL(t,e="utf-8"){let r,n=new Promise((i,o)=>{r=i});return new Promise((i,o)=>{let s=(0,hc.createServer)(a=>{s.close(),r([new yo(a,e),new _o(a,e)])});s.on("error",o),s.listen(t,"127.0.0.1",()=>{s.removeListener("error",o),i({onConnected:()=>n})})})}Ie.createClientSocketTransport=xL;function NL(t,e="utf-8"){let r=(0,hc.createConnection)(t,"127.0.0.1");return[new yo(r,e),new _o(r,e)]}Ie.createServerSocketTransport=NL;function EL(t){let e=t;return e.read!==void 0&&e.addListener!==void 0}function IL(t){let e=t;return e.write!==void 0&&e.addListener!==void 0}function OL(t,e,r,n){r||(r=en.NullLogger);let i=EL(t)?new pc(t):t,o=IL(e)?new mc(e):e;return en.ConnectionStrategy.is(n)&&(n={connectionStrategy:n}),(0,en.createMessageConnection)(i,o,r,n)}Ie.createMessageConnection=OL});var ch=Q((Ij,ov)=>{"use strict";ov.exports=vo()});var Tc=Q((sv,gc)=>{(function(t){if(typeof gc=="object"&&typeof gc.exports=="object"){var e=t(require,sv);e!==void 0&&(gc.exports=e)}else typeof define=="function"&&define.amd&&define(["require","exports"],t)})(function(t,e){"use strict";Object.defineProperty(e,"__esModule",{value:!0}),e.TextDocument=e.EOL=e.WorkspaceFolder=e.InlineCompletionContext=e.SelectedCompletionInfo=e.InlineCompletionTriggerKind=e.InlineCompletionList=e.InlineCompletionItem=e.StringValue=e.InlayHint=e.InlayHintLabelPart=e.InlayHintKind=e.InlineValueContext=e.InlineValueEvaluatableExpression=e.InlineValueVariableLookup=e.InlineValueText=e.SemanticTokens=e.SemanticTokenModifiers=e.SemanticTokenTypes=e.SelectionRange=e.DocumentLink=e.FormattingOptions=e.CodeLens=e.CodeAction=e.CodeActionContext=e.CodeActionTriggerKind=e.CodeActionKind=e.DocumentSymbol=e.WorkspaceSymbol=e.SymbolInformation=e.SymbolTag=e.SymbolKind=e.DocumentHighlight=e.DocumentHighlightKind=e.SignatureInformation=e.ParameterInformation=e.Hover=e.MarkedString=e.CompletionList=e.CompletionItem=e.CompletionItemLabelDetails=e.InsertTextMode=e.InsertReplaceEdit=e.CompletionItemTag=e.InsertTextFormat=e.CompletionItemKind=e.MarkupContent=e.MarkupKind=e.TextDocumentItem=e.OptionalVersionedTextDocumentIdentifier=e.VersionedTextDocumentIdentifier=e.TextDocumentIdentifier=e.WorkspaceChange=e.WorkspaceEdit=e.DeleteFile=e.RenameFile=e.CreateFile=e.TextDocumentEdit=e.AnnotatedTextEdit=e.ChangeAnnotationIdentifier=e.ChangeAnnotation=e.TextEdit=e.Command=e.Diagnostic=e.CodeDescription=e.DiagnosticTag=e.DiagnosticSeverity=e.DiagnosticRelatedInformation=e.FoldingRange=e.FoldingRangeKind=e.ColorPresentation=e.ColorInformation=e.Color=e.LocationLink=e.Location=e.Range=e.Position=e.uinteger=e.integer=e.URI=e.DocumentUri=void 0;var r;(function(h){function N(E){return typeof E=="string"}h.is=N})(r||(e.DocumentUri=r={}));var n;(function(h){function N(E){return typeof E=="string"}h.is=N})(n||(e.URI=n={}));var i;(function(h){h.MIN_VALUE=-2147483648,h.MAX_VALUE=2147483647;function N(E){return typeof E=="number"&&h.MIN_VALUE<=E&&E<=h.MAX_VALUE}h.is=N})(i||(e.integer=i={}));var o;(function(h){h.MIN_VALUE=0,h.MAX_VALUE=2147483647;function N(E){return typeof E=="number"&&h.MIN_VALUE<=E&&E<=h.MAX_VALUE}h.is=N})(o||(e.uinteger=o={}));var s;(function(h){function N(T,p){return T===Number.MAX_VALUE&&(T=o.MAX_VALUE),p===Number.MAX_VALUE&&(p=o.MAX_VALUE),{line:T,character:p}}h.create=N;function E(T){var p=T;return C.objectLiteral(p)&&C.uinteger(p.line)&&C.uinteger(p.character)}h.is=E})(s||(e.Position=s={}));var a;(function(h){function N(T,p,S,W){if(C.uinteger(T)&&C.uinteger(p)&&C.uinteger(S)&&C.uinteger(W))return{start:s.create(T,p),end:s.create(S,W)};if(s.is(T)&&s.is(p))return{start:T,end:p};throw new Error("Range#create called with invalid arguments[".concat(T,", ").concat(p,", ").concat(S,", ").concat(W,"]"))}h.create=N;function E(T){var p=T;return C.objectLiteral(p)&&s.is(p.start)&&s.is(p.end)}h.is=E})(a||(e.Range=a={}));var l;(function(h){function N(T,p){return{uri:T,range:p}}h.create=N;function E(T){var p=T;return C.objectLiteral(p)&&a.is(p.range)&&(C.string(p.uri)||C.undefined(p.uri))}h.is=E})(l||(e.Location=l={}));var u;(function(h){function N(T,p,S,W){return{targetUri:T,targetRange:p,targetSelectionRange:S,originSelectionRange:W}}h.create=N;function E(T){var p=T;return C.objectLiteral(p)&&a.is(p.targetRange)&&C.string(p.targetUri)&&a.is(p.targetSelectionRange)&&(a.is(p.originSelectionRange)||C.undefined(p.originSelectionRange))}h.is=E})(u||(e.LocationLink=u={}));var c;(function(h){function N(T,p,S,W){return{red:T,green:p,blue:S,alpha:W}}h.create=N;function E(T){var p=T;return C.objectLiteral(p)&&C.numberRange(p.red,0,1)&&C.numberRange(p.green,0,1)&&C.numberRange(p.blue,0,1)&&C.numberRange(p.alpha,0,1)}h.is=E})(c||(e.Color=c={}));var f;(function(h){function N(T,p){return{range:T,color:p}}h.create=N;function E(T){var p=T;return C.objectLiteral(p)&&a.is(p.range)&&c.is(p.color)}h.is=E})(f||(e.ColorInformation=f={}));var d;(function(h){function N(T,p,S){return{label:T,textEdit:p,additionalTextEdits:S}}h.create=N;function E(T){var p=T;return C.objectLiteral(p)&&C.string(p.label)&&(C.undefined(p.textEdit)||M.is(p))&&(C.undefined(p.additionalTextEdits)||C.typedArray(p.additionalTextEdits,M.is))}h.is=E})(d||(e.ColorPresentation=d={}));var m;(function(h){h.Comment="comment",h.Imports="imports",h.Region="region"})(m||(e.FoldingRangeKind=m={}));var _;(function(h){function N(T,p,S,W,Te,St){var Je={startLine:T,endLine:p};return C.defined(S)&&(Je.startCharacter=S),C.defined(W)&&(Je.endCharacter=W),C.defined(Te)&&(Je.kind=Te),C.defined(St)&&(Je.collapsedText=St),Je}h.create=N;function E(T){var p=T;return C.objectLiteral(p)&&C.uinteger(p.startLine)&&C.uinteger(p.startLine)&&(C.undefined(p.startCharacter)||C.uinteger(p.startCharacter))&&(C.undefined(p.endCharacter)||C.uinteger(p.endCharacter))&&(C.undefined(p.kind)||C.string(p.kind))}h.is=E})(_||(e.FoldingRange=_={}));var x;(function(h){function N(T,p){return{location:T,message:p}}h.create=N;function E(T){var p=T;return C.defined(p)&&l.is(p.location)&&C.string(p.message)}h.is=E})(x||(e.DiagnosticRelatedInformation=x={}));var A;(function(h){h.Error=1,h.Warning=2,h.Information=3,h.Hint=4})(A||(e.DiagnosticSeverity=A={}));var I;(function(h){h.Unnecessary=1,h.Deprecated=2})(I||(e.DiagnosticTag=I={}));var y;(function(h){function N(E){var T=E;return C.objectLiteral(T)&&C.string(T.href)}h.is=N})(y||(e.CodeDescription=y={}));var g;(function(h){function N(T,p,S,W,Te,St){var Je={range:T,message:p};return C.defined(S)&&(Je.severity=S),C.defined(W)&&(Je.code=W),C.defined(Te)&&(Je.source=Te),C.defined(St)&&(Je.relatedInformation=St),Je}h.create=N;function E(T){var p,S=T;return C.defined(S)&&a.is(S.range)&&C.string(S.message)&&(C.number(S.severity)||C.undefined(S.severity))&&(C.integer(S.code)||C.string(S.code)||C.undefined(S.code))&&(C.undefined(S.codeDescription)||C.string((p=S.codeDescription)===null||p===void 0?void 0:p.href))&&(C.string(S.source)||C.undefined(S.source))&&(C.undefined(S.relatedInformation)||C.typedArray(S.relatedInformation,x.is))}h.is=E})(g||(e.Diagnostic=g={}));var O;(function(h){function N(T,p){for(var S=[],W=2;W<arguments.length;W++)S[W-2]=arguments[W];var Te={title:T,command:p};return C.defined(S)&&S.length>0&&(Te.arguments=S),Te}h.create=N;function E(T){var p=T;return C.defined(p)&&C.string(p.title)&&C.string(p.command)}h.is=E})(O||(e.Command=O={}));var M;(function(h){function N(S,W){return{range:S,newText:W}}h.replace=N;function E(S,W){return{range:{start:S,end:S},newText:W}}h.insert=E;function T(S){return{range:S,newText:""}}h.del=T;function p(S){var W=S;return C.objectLiteral(W)&&C.string(W.newText)&&a.is(W.range)}h.is=p})(M||(e.TextEdit=M={}));var J;(function(h){function N(T,p,S){var W={label:T};return p!==void 0&&(W.needsConfirmation=p),S!==void 0&&(W.description=S),W}h.create=N;function E(T){var p=T;return C.objectLiteral(p)&&C.string(p.label)&&(C.boolean(p.needsConfirmation)||p.needsConfirmation===void 0)&&(C.string(p.description)||p.description===void 0)}h.is=E})(J||(e.ChangeAnnotation=J={}));var ce;(function(h){function N(E){var T=E;return C.string(T)}h.is=N})(ce||(e.ChangeAnnotationIdentifier=ce={}));var _e;(function(h){function N(S,W,Te){return{range:S,newText:W,annotationId:Te}}h.replace=N;function E(S,W,Te){return{range:{start:S,end:S},newText:W,annotationId:Te}}h.insert=E;function T(S,W){return{range:S,newText:"",annotationId:W}}h.del=T;function p(S){var W=S;return M.is(W)&&(J.is(W.annotationId)||ce.is(W.annotationId))}h.is=p})(_e||(e.AnnotatedTextEdit=_e={}));var je;(function(h){function N(T,p){return{textDocument:T,edits:p}}h.create=N;function E(T){var p=T;return C.defined(p)&&le.is(p.textDocument)&&Array.isArray(p.edits)}h.is=E})(je||(e.TextDocumentEdit=je={}));var Ce;(function(h){function N(T,p,S){var W={kind:"create",uri:T};return p!==void 0&&(p.overwrite!==void 0||p.ignoreIfExists!==void 0)&&(W.options=p),S!==void 0&&(W.annotationId=S),W}h.create=N;function E(T){var p=T;return p&&p.kind==="create"&&C.string(p.uri)&&(p.options===void 0||(p.options.overwrite===void 0||C.boolean(p.options.overwrite))&&(p.options.ignoreIfExists===void 0||C.boolean(p.options.ignoreIfExists)))&&(p.annotationId===void 0||ce.is(p.annotationId))}h.is=E})(Ce||(e.CreateFile=Ce={}));var j;(function(h){function N(T,p,S,W){var Te={kind:"rename",oldUri:T,newUri:p};return S!==void 0&&(S.overwrite!==void 0||S.ignoreIfExists!==void 0)&&(Te.options=S),W!==void 0&&(Te.annotationId=W),Te}h.create=N;function E(T){var p=T;return p&&p.kind==="rename"&&C.string(p.oldUri)&&C.string(p.newUri)&&(p.options===void 0||(p.options.overwrite===void 0||C.boolean(p.options.overwrite))&&(p.options.ignoreIfExists===void 0||C.boolean(p.options.ignoreIfExists)))&&(p.annotationId===void 0||ce.is(p.annotationId))}h.is=E})(j||(e.RenameFile=j={}));var k;(function(h){function N(T,p,S){var W={kind:"delete",uri:T};return p!==void 0&&(p.recursive!==void 0||p.ignoreIfNotExists!==void 0)&&(W.options=p),S!==void 0&&(W.annotationId=S),W}h.create=N;function E(T){var p=T;return p&&p.kind==="delete"&&C.string(p.uri)&&(p.options===void 0||(p.options.recursive===void 0||C.boolean(p.options.recursive))&&(p.options.ignoreIfNotExists===void 0||C.boolean(p.options.ignoreIfNotExists)))&&(p.annotationId===void 0||ce.is(p.annotationId))}h.is=E})(k||(e.DeleteFile=k={}));var V;(function(h){function N(E){var T=E;return T&&(T.changes!==void 0||T.documentChanges!==void 0)&&(T.documentChanges===void 0||T.documentChanges.every(function(p){return C.string(p.kind)?Ce.is(p)||j.is(p)||k.is(p):je.is(p)}))}h.is=N})(V||(e.WorkspaceEdit=V={}));var G=function(){function h(N,E){this.edits=N,this.changeAnnotations=E}return h.prototype.insert=function(N,E,T){var p,S;if(T===void 0?p=M.insert(N,E):ce.is(T)?(S=T,p=_e.insert(N,E,T)):(this.assertChangeAnnotations(this.changeAnnotations),S=this.changeAnnotations.manage(T),p=_e.insert(N,E,S)),this.edits.push(p),S!==void 0)return S},h.prototype.replace=function(N,E,T){var p,S;if(T===void 0?p=M.replace(N,E):ce.is(T)?(S=T,p=_e.replace(N,E,T)):(this.assertChangeAnnotations(this.changeAnnotations),S=this.changeAnnotations.manage(T),p=_e.replace(N,E,S)),this.edits.push(p),S!==void 0)return S},h.prototype.delete=function(N,E){var T,p;if(E===void 0?T=M.del(N):ce.is(E)?(p=E,T=_e.del(N,E)):(this.assertChangeAnnotations(this.changeAnnotations),p=this.changeAnnotations.manage(E),T=_e.del(N,p)),this.edits.push(T),p!==void 0)return p},h.prototype.add=function(N){this.edits.push(N)},h.prototype.all=function(){return this.edits},h.prototype.clear=function(){this.edits.splice(0,this.edits.length)},h.prototype.assertChangeAnnotations=function(N){if(N===void 0)throw new Error("Text edit change is not configured to manage change annotations.")},h}(),ie=function(){function h(N){this._annotations=N===void 0?Object.create(null):N,this._counter=0,this._size=0}return h.prototype.all=function(){return this._annotations},Object.defineProperty(h.prototype,"size",{get:function(){return this._size},enumerable:!1,configurable:!0}),h.prototype.manage=function(N,E){var T;if(ce.is(N)?T=N:(T=this.nextId(),E=N),this._annotations[T]!==void 0)throw new Error("Id ".concat(T," is already in use."));if(E===void 0)throw new Error("No annotation provided for id ".concat(T));return this._annotations[T]=E,this._size++,T},h.prototype.nextId=function(){return this._counter++,this._counter.toString()},h}(),z=function(){function h(N){var E=this;this._textEditChanges=Object.create(null),N!==void 0?(this._workspaceEdit=N,N.documentChanges?(this._changeAnnotations=new ie(N.changeAnnotations),N.changeAnnotations=this._changeAnnotations.all(),N.documentChanges.forEach(function(T){if(je.is(T)){var p=new G(T.edits,E._changeAnnotations);E._textEditChanges[T.textDocument.uri]=p}})):N.changes&&Object.keys(N.changes).forEach(function(T){var p=new G(N.changes[T]);E._textEditChanges[T]=p})):this._workspaceEdit={}}return Object.defineProperty(h.prototype,"edit",{get:function(){return this.initDocumentChanges(),this._changeAnnotations!==void 0&&(this._changeAnnotations.size===0?this._workspaceEdit.changeAnnotations=void 0:this._workspaceEdit.changeAnnotations=this._changeAnnotations.all()),this._workspaceEdit},enumerable:!1,configurable:!0}),h.prototype.getTextEditChange=function(N){if(le.is(N)){if(this.initDocumentChanges(),this._workspaceEdit.documentChanges===void 0)throw new Error("Workspace edit is not configured for document changes.");var E={uri:N.uri,version:N.version},T=this._textEditChanges[E.uri];if(!T){var p=[],S={textDocument:E,edits:p};this._workspaceEdit.documentChanges.push(S),T=new G(p,this._changeAnnotations),this._textEditChanges[E.uri]=T}return T}else{if(this.initChanges(),this._workspaceEdit.changes===void 0)throw new Error("Workspace edit is not configured for normal text edit changes.");var T=this._textEditChanges[N];if(!T){var p=[];this._workspaceEdit.changes[N]=p,T=new G(p),this._textEditChanges[N]=T}return T}},h.prototype.initDocumentChanges=function(){this._workspaceEdit.documentChanges===void 0&&this._workspaceEdit.changes===void 0&&(this._changeAnnotations=new ie,this._workspaceEdit.documentChanges=[],this._workspaceEdit.changeAnnotations=this._changeAnnotations.all())},h.prototype.initChanges=function(){this._workspaceEdit.documentChanges===void 0&&this._workspaceEdit.changes===void 0&&(this._workspaceEdit.changes=Object.create(null))},h.prototype.createFile=function(N,E,T){if(this.initDocumentChanges(),this._workspaceEdit.documentChanges===void 0)throw new Error("Workspace edit is not configured for document changes.");var p;J.is(E)||ce.is(E)?p=E:T=E;var S,W;if(p===void 0?S=Ce.create(N,T):(W=ce.is(p)?p:this._changeAnnotations.manage(p),S=Ce.create(N,T,W)),this._workspaceEdit.documentChanges.push(S),W!==void 0)return W},h.prototype.renameFile=function(N,E,T,p){if(this.initDocumentChanges(),this._workspaceEdit.documentChanges===void 0)throw new Error("Workspace edit is not configured for document changes.");var S;J.is(T)||ce.is(T)?S=T:p=T;var W,Te;if(S===void 0?W=j.create(N,E,p):(Te=ce.is(S)?S:this._changeAnnotations.manage(S),W=j.create(N,E,p,Te)),this._workspaceEdit.documentChanges.push(W),Te!==void 0)return Te},h.prototype.deleteFile=function(N,E,T){if(this.initDocumentChanges(),this._workspaceEdit.documentChanges===void 0)throw new Error("Workspace edit is not configured for document changes.");var p;J.is(E)||ce.is(E)?p=E:T=E;var S,W;if(p===void 0?S=k.create(N,T):(W=ce.is(p)?p:this._changeAnnotations.manage(p),S=k.create(N,T,W)),this._workspaceEdit.documentChanges.push(S),W!==void 0)return W},h}();e.WorkspaceChange=z;var $;(function(h){function N(T){return{uri:T}}h.create=N;function E(T){var p=T;return C.defined(p)&&C.string(p.uri)}h.is=E})($||(e.TextDocumentIdentifier=$={}));var w;(function(h){function N(T,p){return{uri:T,version:p}}h.create=N;function E(T){var p=T;return C.defined(p)&&C.string(p.uri)&&C.integer(p.version)}h.is=E})(w||(e.VersionedTextDocumentIdentifier=w={}));var le;(function(h){function N(T,p){return{uri:T,version:p}}h.create=N;function E(T){var p=T;return C.defined(p)&&C.string(p.uri)&&(p.version===null||C.integer(p.version))}h.is=E})(le||(e.OptionalVersionedTextDocumentIdentifier=le={}));var he;(function(h){function N(T,p,S,W){return{uri:T,languageId:p,version:S,text:W}}h.create=N;function E(T){var p=T;return C.defined(p)&&C.string(p.uri)&&C.string(p.languageId)&&C.integer(p.version)&&C.string(p.text)}h.is=E})(he||(e.TextDocumentItem=he={}));var Se;(function(h){h.PlainText="plaintext",h.Markdown="markdown";function N(E){var T=E;return T===h.PlainText||T===h.Markdown}h.is=N})(Se||(e.MarkupKind=Se={}));var ar;(function(h){function N(E){var T=E;return C.objectLiteral(E)&&Se.is(T.kind)&&C.string(T.value)}h.is=N})(ar||(e.MarkupContent=ar={}));var Ii;(function(h){h.Text=1,h.Method=2,h.Function=3,h.Constructor=4,h.Field=5,h.Variable=6,h.Class=7,h.Interface=8,h.Module=9,h.Property=10,h.Unit=11,h.Value=12,h.Enum=13,h.Keyword=14,h.Snippet=15,h.Color=16,h.File=17,h.Reference=18,h.Folder=19,h.EnumMember=20,h.Constant=21,h.Struct=22,h.Event=23,h.Operator=24,h.TypeParameter=25})(Ii||(e.CompletionItemKind=Ii={}));var qe;(function(h){h.PlainText=1,h.Snippet=2})(qe||(e.InsertTextFormat=qe={}));var Xt;(function(h){h.Deprecated=1})(Xt||(e.CompletionItemTag=Xt={}));var ti;(function(h){function N(T,p,S){return{newText:T,insert:p,replace:S}}h.create=N;function E(T){var p=T;return p&&C.string(p.newText)&&a.is(p.insert)&&a.is(p.replace)}h.is=E})(ti||(e.InsertReplaceEdit=ti={}));var ht;(function(h){h.asIs=1,h.adjustIndentation=2})(ht||(e.InsertTextMode=ht={}));var Jt;(function(h){function N(E){var T=E;return T&&(C.string(T.detail)||T.detail===void 0)&&(C.string(T.description)||T.description===void 0)}h.is=N})(Jt||(e.CompletionItemLabelDetails=Jt={}));var Pt;(function(h){function N(E){return{label:E}}h.create=N})(Pt||(e.CompletionItem=Pt={}));var Mt;(function(h){function N(E,T){return{items:E||[],isIncomplete:!!T}}h.create=N})(Mt||(e.CompletionList=Mt={}));var gt;(function(h){function N(T){return T.replace(/[\\`*_{}[\]()#+\-.!]/g,"\\$&")}h.fromPlainText=N;function E(T){var p=T;return C.string(p)||C.objectLiteral(p)&&C.string(p.language)&&C.string(p.value)}h.is=E})(gt||(e.MarkedString=gt={}));var Tt;(function(h){function N(E){var T=E;return!!T&&C.objectLiteral(T)&&(ar.is(T.contents)||gt.is(T.contents)||C.typedArray(T.contents,gt.is))&&(E.range===void 0||a.is(E.range))}h.is=N})(Tt||(e.Hover=Tt={}));var hr;(function(h){function N(E,T){return T?{label:E,documentation:T}:{label:E}}h.create=N})(hr||(e.ParameterInformation=hr={}));var Ir;(function(h){function N(E,T){for(var p=[],S=2;S<arguments.length;S++)p[S-2]=arguments[S];var W={label:E};return C.defined(T)&&(W.documentation=T),C.defined(p)?W.parameters=p:W.parameters=[],W}h.create=N})(Ir||(e.SignatureInformation=Ir={}));var Jr;(function(h){h.Text=1,h.Read=2,h.Write=3})(Jr||(e.DocumentHighlightKind=Jr={}));var ri;(function(h){function N(E,T){var p={range:E};return C.number(T)&&(p.kind=T),p}h.create=N})(ri||(e.DocumentHighlight=ri={}));var Oi;(function(h){h.File=1,h.Module=2,h.Namespace=3,h.Package=4,h.Class=5,h.Method=6,h.Property=7,h.Field=8,h.Constructor=9,h.Enum=10,h.Interface=11,h.Function=12,h.Variable=13,h.Constant=14,h.String=15,h.Number=16,h.Boolean=17,h.Array=18,h.Object=19,h.Key=20,h.Null=21,h.EnumMember=22,h.Struct=23,h.Event=24,h.Operator=25,h.TypeParameter=26})(Oi||(e.SymbolKind=Oi={}));var ps;(function(h){h.Deprecated=1})(ps||(e.SymbolTag=ps={}));var Qr;(function(h){function N(E,T,p,S,W){var Te={name:E,kind:T,location:{uri:S,range:p}};return W&&(Te.containerName=W),Te}h.create=N})(Qr||(e.SymbolInformation=Qr={}));var wn;(function(h){function N(E,T,p,S){return S!==void 0?{name:E,kind:T,location:{uri:p,range:S}}:{name:E,kind:T,location:{uri:p}}}h.create=N})(wn||(e.WorkspaceSymbol=wn={}));var ms;(function(h){function N(T,p,S,W,Te,St){var Je={name:T,detail:p,kind:S,range:W,selectionRange:Te};return St!==void 0&&(Je.children=St),Je}h.create=N;function E(T){var p=T;return p&&C.string(p.name)&&C.number(p.kind)&&a.is(p.range)&&a.is(p.selectionRange)&&(p.detail===void 0||C.string(p.detail))&&(p.deprecated===void 0||C.boolean(p.deprecated))&&(p.children===void 0||Array.isArray(p.children))&&(p.tags===void 0||Array.isArray(p.tags))}h.is=E})(ms||(e.DocumentSymbol=ms={}));var hs;(function(h){h.Empty="",h.QuickFix="quickfix",h.Refactor="refactor",h.RefactorExtract="refactor.extract",h.RefactorInline="refactor.inline",h.RefactorRewrite="refactor.rewrite",h.Source="source",h.SourceOrganizeImports="source.organizeImports",h.SourceFixAll="source.fixAll"})(hs||(e.CodeActionKind=hs={}));var Pr;(function(h){h.Invoked=1,h.Automatic=2})(Pr||(e.CodeActionTriggerKind=Pr={}));var D;(function(h){function N(T,p,S){var W={diagnostics:T};return p!=null&&(W.only=p),S!=null&&(W.triggerKind=S),W}h.create=N;function E(T){var p=T;return C.defined(p)&&C.typedArray(p.diagnostics,g.is)&&(p.only===void 0||C.typedArray(p.only,C.string))&&(p.triggerKind===void 0||p.triggerKind===Pr.Invoked||p.triggerKind===Pr.Automatic)}h.is=E})(D||(e.CodeActionContext=D={}));var F;(function(h){function N(T,p,S){var W={title:T},Te=!0;return typeof p=="string"?(Te=!1,W.kind=p):O.is(p)?W.command=p:W.edit=p,Te&&S!==void 0&&(W.kind=S),W}h.create=N;function E(T){var p=T;return p&&C.string(p.title)&&(p.diagnostics===void 0||C.typedArray(p.diagnostics,g.is))&&(p.kind===void 0||C.string(p.kind))&&(p.edit!==void 0||p.command!==void 0)&&(p.command===void 0||O.is(p.command))&&(p.isPreferred===void 0||C.boolean(p.isPreferred))&&(p.edit===void 0||V.is(p.edit))}h.is=E})(F||(e.CodeAction=F={}));var q;(function(h){function N(T,p){var S={range:T};return C.defined(p)&&(S.data=p),S}h.create=N;function E(T){var p=T;return C.defined(p)&&a.is(p.range)&&(C.undefined(p.command)||O.is(p.command))}h.is=E})(q||(e.CodeLens=q={}));var Y;(function(h){function N(T,p){return{tabSize:T,insertSpaces:p}}h.create=N;function E(T){var p=T;return C.defined(p)&&C.uinteger(p.tabSize)&&C.boolean(p.insertSpaces)}h.is=E})(Y||(e.FormattingOptions=Y={}));var ee;(function(h){function N(T,p,S){return{range:T,target:p,data:S}}h.create=N;function E(T){var p=T;return C.defined(p)&&a.is(p.range)&&(C.undefined(p.target)||C.string(p.target))}h.is=E})(ee||(e.DocumentLink=ee={}));var R;(function(h){function N(T,p){return{range:T,parent:p}}h.create=N;function E(T){var p=T;return C.objectLiteral(p)&&a.is(p.range)&&(p.parent===void 0||h.is(p.parent))}h.is=E})(R||(e.SelectionRange=R={}));var L;(function(h){h.namespace="namespace",h.type="type",h.class="class",h.enum="enum",h.interface="interface",h.struct="struct",h.typeParameter="typeParameter",h.parameter="parameter",h.variable="variable",h.property="property",h.enumMember="enumMember",h.event="event",h.function="function",h.method="method",h.macro="macro",h.keyword="keyword",h.modifier="modifier",h.comment="comment",h.string="string",h.number="number",h.regexp="regexp",h.operator="operator",h.decorator="decorator"})(L||(e.SemanticTokenTypes=L={}));var U;(function(h){h.declaration="declaration",h.definition="definition",h.readonly="readonly",h.static="static",h.deprecated="deprecated",h.abstract="abstract",h.async="async",h.modification="modification",h.documentation="documentation",h.defaultLibrary="defaultLibrary"})(U||(e.SemanticTokenModifiers=U={}));var B;(function(h){function N(E){var T=E;return C.objectLiteral(T)&&(T.resultId===void 0||typeof T.resultId=="string")&&Array.isArray(T.data)&&(T.data.length===0||typeof T.data[0]=="number")}h.is=N})(B||(e.SemanticTokens=B={}));var oe;(function(h){function N(T,p){return{range:T,text:p}}h.create=N;function E(T){var p=T;return p!=null&&a.is(p.range)&&C.string(p.text)}h.is=E})(oe||(e.InlineValueText=oe={}));var ne;(function(h){function N(T,p,S){return{range:T,variableName:p,caseSensitiveLookup:S}}h.create=N;function E(T){var p=T;return p!=null&&a.is(p.range)&&C.boolean(p.caseSensitiveLookup)&&(C.string(p.variableName)||p.variableName===void 0)}h.is=E})(ne||(e.InlineValueVariableLookup=ne={}));var xe;(function(h){function N(T,p){return{range:T,expression:p}}h.create=N;function E(T){var p=T;return p!=null&&a.is(p.range)&&(C.string(p.expression)||p.expression===void 0)}h.is=E})(xe||(e.InlineValueEvaluatableExpression=xe={}));var He;(function(h){function N(T,p){return{frameId:T,stoppedLocation:p}}h.create=N;function E(T){var p=T;return C.defined(p)&&a.is(T.stoppedLocation)}h.is=E})(He||(e.InlineValueContext=He={}));var Ft;(function(h){h.Type=1,h.Parameter=2;function N(E){return E===1||E===2}h.is=N})(Ft||(e.InlayHintKind=Ft={}));var be;(function(h){function N(T){return{value:T}}h.create=N;function E(T){var p=T;return C.objectLiteral(p)&&(p.tooltip===void 0||C.string(p.tooltip)||ar.is(p.tooltip))&&(p.location===void 0||l.is(p.location))&&(p.command===void 0||O.is(p.command))}h.is=E})(be||(e.InlayHintLabelPart=be={}));var ut;(function(h){function N(T,p,S){var W={position:T,label:p};return S!==void 0&&(W.kind=S),W}h.create=N;function E(T){var p=T;return C.objectLiteral(p)&&s.is(p.position)&&(C.string(p.label)||C.typedArray(p.label,be.is))&&(p.kind===void 0||Ft.is(p.kind))&&p.textEdits===void 0||C.typedArray(p.textEdits,M.is)&&(p.tooltip===void 0||C.string(p.tooltip)||ar.is(p.tooltip))&&(p.paddingLeft===void 0||C.boolean(p.paddingLeft))&&(p.paddingRight===void 0||C.boolean(p.paddingRight))}h.is=E})(ut||(e.InlayHint=ut={}));var Ve;(function(h){function N(E){return{kind:"snippet",value:E}}h.createSnippet=N})(Ve||(e.StringValue=Ve={}));var ct;(function(h){function N(E,T,p,S){return{insertText:E,filterText:T,range:p,command:S}}h.create=N})(ct||(e.InlineCompletionItem=ct={}));var Ut;(function(h){function N(E){return{items:E}}h.create=N})(Ut||(e.InlineCompletionList=Ut={}));var qu;(function(h){h.Invoked=0,h.Automatic=1})(qu||(e.InlineCompletionTriggerKind=qu={}));var R_;(function(h){function N(E,T){return{range:E,text:T}}h.create=N})(R_||(e.SelectedCompletionInfo=R_={}));var x_;(function(h){function N(E,T){return{triggerKind:E,selectedCompletionInfo:T}}h.create=N})(x_||(e.InlineCompletionContext=x_={}));var N_;(function(h){function N(E){var T=E;return C.objectLiteral(T)&&n.is(T.uri)&&C.string(T.name)}h.is=N})(N_||(e.WorkspaceFolder=N_={})),e.EOL=[`
`,`\r
`,"\r"];var E_;(function(h){function N(S,W,Te,St){return new kb(S,W,Te,St)}h.create=N;function E(S){var W=S;return!!(C.defined(W)&&C.string(W.uri)&&(C.undefined(W.languageId)||C.string(W.languageId))&&C.uinteger(W.lineCount)&&C.func(W.getText)&&C.func(W.positionAt)&&C.func(W.offsetAt))}h.is=E;function T(S,W){for(var Te=S.getText(),St=p(W,function(gs,Hu){var I_=gs.range.start.line-Hu.range.start.line;return I_===0?gs.range.start.character-Hu.range.start.character:I_}),Je=Te.length,yn=St.length-1;yn>=0;yn--){var _n=St[yn],ni=S.offsetAt(_n.range.start),Ee=S.offsetAt(_n.range.end);if(Ee<=Je)Te=Te.substring(0,ni)+_n.newText+Te.substring(Ee,Te.length);else throw new Error("Overlapping edit");Je=ni}return Te}h.applyEdits=T;function p(S,W){if(S.length<=1)return S;var Te=S.length/2|0,St=S.slice(0,Te),Je=S.slice(Te);p(St,W),p(Je,W);for(var yn=0,_n=0,ni=0;yn<St.length&&_n<Je.length;){var Ee=W(St[yn],Je[_n]);Ee<=0?S[ni++]=St[yn++]:S[ni++]=Je[_n++]}for(;yn<St.length;)S[ni++]=St[yn++];for(;_n<Je.length;)S[ni++]=Je[_n++];return S}})(E_||(e.TextDocument=E_={}));var kb=function(){function h(N,E,T,p){this._uri=N,this._languageId=E,this._version=T,this._content=p,this._lineOffsets=void 0}return Object.defineProperty(h.prototype,"uri",{get:function(){return this._uri},enumerable:!1,configurable:!0}),Object.defineProperty(h.prototype,"languageId",{get:function(){return this._languageId},enumerable:!1,configurable:!0}),Object.defineProperty(h.prototype,"version",{get:function(){return this._version},enumerable:!1,configurable:!0}),h.prototype.getText=function(N){if(N){var E=this.offsetAt(N.start),T=this.offsetAt(N.end);return this._content.substring(E,T)}return this._content},h.prototype.update=function(N,E){this._content=N.text,this._version=E,this._lineOffsets=void 0},h.prototype.getLineOffsets=function(){if(this._lineOffsets===void 0){for(var N=[],E=this._content,T=!0,p=0;p<E.length;p++){T&&(N.push(p),T=!1);var S=E.charAt(p);T=S==="\r"||S===`
`,S==="\r"&&p+1<E.length&&E.charAt(p+1)===`
`&&p++}T&&E.length>0&&N.push(E.length),this._lineOffsets=N}return this._lineOffsets},h.prototype.positionAt=function(N){N=Math.max(Math.min(N,this._content.length),0);var E=this.getLineOffsets(),T=0,p=E.length;if(p===0)return s.create(0,N);for(;T<p;){var S=Math.floor((T+p)/2);E[S]>N?p=S:T=S+1}var W=T-1;return s.create(W,N-E[W])},h.prototype.offsetAt=function(N){var E=this.getLineOffsets();if(N.line>=E.length)return this._content.length;if(N.line<0)return 0;var T=E[N.line],p=N.line+1<E.length?E[N.line+1]:this._content.length;return Math.max(Math.min(T+N.character,p),T)},Object.defineProperty(h.prototype,"lineCount",{get:function(){return this.getLineOffsets().length},enumerable:!1,configurable:!0}),h}(),C;(function(h){var N=Object.prototype.toString;function E(Ee){return typeof Ee!="undefined"}h.defined=E;function T(Ee){return typeof Ee=="undefined"}h.undefined=T;function p(Ee){return Ee===!0||Ee===!1}h.boolean=p;function S(Ee){return N.call(Ee)==="[object String]"}h.string=S;function W(Ee){return N.call(Ee)==="[object Number]"}h.number=W;function Te(Ee,gs,Hu){return N.call(Ee)==="[object Number]"&&gs<=Ee&&Ee<=Hu}h.numberRange=Te;function St(Ee){return N.call(Ee)==="[object Number]"&&-2147483648<=Ee&&Ee<=2147483647}h.integer=St;function Je(Ee){return N.call(Ee)==="[object Number]"&&0<=Ee&&Ee<=2147483647}h.uinteger=Je;function yn(Ee){return N.call(Ee)==="[object Function]"}h.func=yn;function _n(Ee){return Ee!==null&&typeof Ee=="object"}h.objectLiteral=_n;function ni(Ee,gs){return Array.isArray(Ee)&&Ee.every(gs)}h.typedArray=ni})(C||(C={}))})});var ft=Q(Fr=>{"use strict";Object.defineProperty(Fr,"__esModule",{value:!0});Fr.ProtocolNotificationType=Fr.ProtocolNotificationType0=Fr.ProtocolRequestType=Fr.ProtocolRequestType0=Fr.RegistrationType=Fr.MessageDirection=void 0;var Is=vo(),av;(function(t){t.clientToServer="clientToServer",t.serverToClient="serverToClient",t.both="both"})(av||(Fr.MessageDirection=av={}));var fh=class{constructor(e){this.method=e}};Fr.RegistrationType=fh;var dh=class extends Is.RequestType0{constructor(e){super(e)}};Fr.ProtocolRequestType0=dh;var ph=class extends Is.RequestType{constructor(e){super(e,Is.ParameterStructures.byName)}};Fr.ProtocolRequestType=ph;var mh=class extends Is.NotificationType0{constructor(e){super(e)}};Fr.ProtocolNotificationType0=mh;var hh=class extends Is.NotificationType{constructor(e){super(e,Is.ParameterStructures.byName)}};Fr.ProtocolNotificationType=hh});var yc=Q(qt=>{"use strict";Object.defineProperty(qt,"__esModule",{value:!0});qt.objectLiteral=qt.typedArray=qt.stringArray=qt.array=qt.func=qt.error=qt.number=qt.string=qt.boolean=void 0;function AL(t){return t===!0||t===!1}qt.boolean=AL;function lv(t){return typeof t=="string"||t instanceof String}qt.string=lv;function SL(t){return typeof t=="number"||t instanceof Number}qt.number=SL;function DL(t){return t instanceof Error}qt.error=DL;function CL(t){return typeof t=="function"}qt.func=CL;function uv(t){return Array.isArray(t)}qt.array=uv;function bL(t){return uv(t)&&t.every(e=>lv(e))}qt.stringArray=bL;function LL(t,e){return Array.isArray(t)&&t.every(e)}qt.typedArray=LL;function kL(t){return t!==null&&typeof t=="object"}qt.objectLiteral=kL});var dv=Q(_c=>{"use strict";Object.defineProperty(_c,"__esModule",{value:!0});_c.ImplementationRequest=void 0;var cv=ft(),fv;(function(t){t.method="textDocument/implementation",t.messageDirection=cv.MessageDirection.clientToServer,t.type=new cv.ProtocolRequestType(t.method)})(fv||(_c.ImplementationRequest=fv={}))});var hv=Q(vc=>{"use strict";Object.defineProperty(vc,"__esModule",{value:!0});vc.TypeDefinitionRequest=void 0;var pv=ft(),mv;(function(t){t.method="textDocument/typeDefinition",t.messageDirection=pv.MessageDirection.clientToServer,t.type=new pv.ProtocolRequestType(t.method)})(mv||(vc.TypeDefinitionRequest=mv={}))});var yv=Q(Os=>{"use strict";Object.defineProperty(Os,"__esModule",{value:!0});Os.DidChangeWorkspaceFoldersNotification=Os.WorkspaceFoldersRequest=void 0;var Rc=ft(),gv;(function(t){t.method="workspace/workspaceFolders",t.messageDirection=Rc.MessageDirection.serverToClient,t.type=new Rc.ProtocolRequestType0(t.method)})(gv||(Os.WorkspaceFoldersRequest=gv={}));var Tv;(function(t){t.method="workspace/didChangeWorkspaceFolders",t.messageDirection=Rc.MessageDirection.clientToServer,t.type=new Rc.ProtocolNotificationType(t.method)})(Tv||(Os.DidChangeWorkspaceFoldersNotification=Tv={}))});var Rv=Q(xc=>{"use strict";Object.defineProperty(xc,"__esModule",{value:!0});xc.ConfigurationRequest=void 0;var _v=ft(),vv;(function(t){t.method="workspace/configuration",t.messageDirection=_v.MessageDirection.serverToClient,t.type=new _v.ProtocolRequestType(t.method)})(vv||(xc.ConfigurationRequest=vv={}))});var Ev=Q(As=>{"use strict";Object.defineProperty(As,"__esModule",{value:!0});As.ColorPresentationRequest=As.DocumentColorRequest=void 0;var Nc=ft(),xv;(function(t){t.method="textDocument/documentColor",t.messageDirection=Nc.MessageDirection.clientToServer,t.type=new Nc.ProtocolRequestType(t.method)})(xv||(As.DocumentColorRequest=xv={}));var Nv;(function(t){t.method="textDocument/colorPresentation",t.messageDirection=Nc.MessageDirection.clientToServer,t.type=new Nc.ProtocolRequestType(t.method)})(Nv||(As.ColorPresentationRequest=Nv={}))});var Av=Q(Ss=>{"use strict";Object.defineProperty(Ss,"__esModule",{value:!0});Ss.FoldingRangeRefreshRequest=Ss.FoldingRangeRequest=void 0;var Ec=ft(),Iv;(function(t){t.method="textDocument/foldingRange",t.messageDirection=Ec.MessageDirection.clientToServer,t.type=new Ec.ProtocolRequestType(t.method)})(Iv||(Ss.FoldingRangeRequest=Iv={}));var Ov;(function(t){t.method="workspace/foldingRange/refresh",t.messageDirection=Ec.MessageDirection.serverToClient,t.type=new Ec.ProtocolRequestType0(t.method)})(Ov||(Ss.FoldingRangeRefreshRequest=Ov={}))});var Cv=Q(Ic=>{"use strict";Object.defineProperty(Ic,"__esModule",{value:!0});Ic.DeclarationRequest=void 0;var Sv=ft(),Dv;(function(t){t.method="textDocument/declaration",t.messageDirection=Sv.MessageDirection.clientToServer,t.type=new Sv.ProtocolRequestType(t.method)})(Dv||(Ic.DeclarationRequest=Dv={}))});var kv=Q(Oc=>{"use strict";Object.defineProperty(Oc,"__esModule",{value:!0});Oc.SelectionRangeRequest=void 0;var bv=ft(),Lv;(function(t){t.method="textDocument/selectionRange",t.messageDirection=bv.MessageDirection.clientToServer,t.type=new bv.ProtocolRequestType(t.method)})(Lv||(Oc.SelectionRangeRequest=Lv={}))});var Mv=Q(ki=>{"use strict";Object.defineProperty(ki,"__esModule",{value:!0});ki.WorkDoneProgressCancelNotification=ki.WorkDoneProgressCreateRequest=ki.WorkDoneProgress=void 0;var wL=vo(),Ac=ft(),wv;(function(t){t.type=new wL.ProgressType;function e(r){return r===t.type}t.is=e})(wv||(ki.WorkDoneProgress=wv={}));var $v;(function(t){t.method="window/workDoneProgress/create",t.messageDirection=Ac.MessageDirection.serverToClient,t.type=new Ac.ProtocolRequestType(t.method)})($v||(ki.WorkDoneProgressCreateRequest=$v={}));var Pv;(function(t){t.method="window/workDoneProgress/cancel",t.messageDirection=Ac.MessageDirection.clientToServer,t.type=new Ac.ProtocolNotificationType(t.method)})(Pv||(ki.WorkDoneProgressCancelNotification=Pv={}))});var Bv=Q(wi=>{"use strict";Object.defineProperty(wi,"__esModule",{value:!0});wi.CallHierarchyOutgoingCallsRequest=wi.CallHierarchyIncomingCallsRequest=wi.CallHierarchyPrepareRequest=void 0;var Ds=ft(),Fv;(function(t){t.method="textDocument/prepareCallHierarchy",t.messageDirection=Ds.MessageDirection.clientToServer,t.type=new Ds.ProtocolRequestType(t.method)})(Fv||(wi.CallHierarchyPrepareRequest=Fv={}));var Uv;(function(t){t.method="callHierarchy/incomingCalls",t.messageDirection=Ds.MessageDirection.clientToServer,t.type=new Ds.ProtocolRequestType(t.method)})(Uv||(wi.CallHierarchyIncomingCallsRequest=Uv={}));var Vv;(function(t){t.method="callHierarchy/outgoingCalls",t.messageDirection=Ds.MessageDirection.clientToServer,t.type=new Ds.ProtocolRequestType(t.method)})(Vv||(wi.CallHierarchyOutgoingCallsRequest=Vv={}))});var Kv=Q(Ur=>{"use strict";Object.defineProperty(Ur,"__esModule",{value:!0});Ur.SemanticTokensRefreshRequest=Ur.SemanticTokensRangeRequest=Ur.SemanticTokensDeltaRequest=Ur.SemanticTokensRequest=Ur.SemanticTokensRegistrationType=Ur.TokenFormat=void 0;var oi=ft(),Wv;(function(t){t.Relative="relative"})(Wv||(Ur.TokenFormat=Wv={}));var cl;(function(t){t.method="textDocument/semanticTokens",t.type=new oi.RegistrationType(t.method)})(cl||(Ur.SemanticTokensRegistrationType=cl={}));var Gv;(function(t){t.method="textDocument/semanticTokens/full",t.messageDirection=oi.MessageDirection.clientToServer,t.type=new oi.ProtocolRequestType(t.method),t.registrationMethod=cl.method})(Gv||(Ur.SemanticTokensRequest=Gv={}));var jv;(function(t){t.method="textDocument/semanticTokens/full/delta",t.messageDirection=oi.MessageDirection.clientToServer,t.type=new oi.ProtocolRequestType(t.method),t.registrationMethod=cl.method})(jv||(Ur.SemanticTokensDeltaRequest=jv={}));var qv;(function(t){t.method="textDocument/semanticTokens/range",t.messageDirection=oi.MessageDirection.clientToServer,t.type=new oi.ProtocolRequestType(t.method),t.registrationMethod=cl.method})(qv||(Ur.SemanticTokensRangeRequest=qv={}));var Hv;(function(t){t.method="workspace/semanticTokens/refresh",t.messageDirection=oi.MessageDirection.serverToClient,t.type=new oi.ProtocolRequestType0(t.method)})(Hv||(Ur.SemanticTokensRefreshRequest=Hv={}))});var Xv=Q(Sc=>{"use strict";Object.defineProperty(Sc,"__esModule",{value:!0});Sc.ShowDocumentRequest=void 0;var zv=ft(),Yv;(function(t){t.method="window/showDocument",t.messageDirection=zv.MessageDirection.serverToClient,t.type=new zv.ProtocolRequestType(t.method)})(Yv||(Sc.ShowDocumentRequest=Yv={}))});var Zv=Q(Dc=>{"use strict";Object.defineProperty(Dc,"__esModule",{value:!0});Dc.LinkedEditingRangeRequest=void 0;var Jv=ft(),Qv;(function(t){t.method="textDocument/linkedEditingRange",t.messageDirection=Jv.MessageDirection.clientToServer,t.type=new Jv.ProtocolRequestType(t.method)})(Qv||(Dc.LinkedEditingRangeRequest=Qv={}))});var aR=Q(yr=>{"use strict";Object.defineProperty(yr,"__esModule",{value:!0});yr.WillDeleteFilesRequest=yr.DidDeleteFilesNotification=yr.DidRenameFilesNotification=yr.WillRenameFilesRequest=yr.DidCreateFilesNotification=yr.WillCreateFilesRequest=yr.FileOperationPatternKind=void 0;var on=ft(),eR;(function(t){t.file="file",t.folder="folder"})(eR||(yr.FileOperationPatternKind=eR={}));var tR;(function(t){t.method="workspace/willCreateFiles",t.messageDirection=on.MessageDirection.clientToServer,t.type=new on.ProtocolRequestType(t.method)})(tR||(yr.WillCreateFilesRequest=tR={}));var rR;(function(t){t.method="workspace/didCreateFiles",t.messageDirection=on.MessageDirection.clientToServer,t.type=new on.ProtocolNotificationType(t.method)})(rR||(yr.DidCreateFilesNotification=rR={}));var nR;(function(t){t.method="workspace/willRenameFiles",t.messageDirection=on.MessageDirection.clientToServer,t.type=new on.ProtocolRequestType(t.method)})(nR||(yr.WillRenameFilesRequest=nR={}));var iR;(function(t){t.method="workspace/didRenameFiles",t.messageDirection=on.MessageDirection.clientToServer,t.type=new on.ProtocolNotificationType(t.method)})(iR||(yr.DidRenameFilesNotification=iR={}));var oR;(function(t){t.method="workspace/didDeleteFiles",t.messageDirection=on.MessageDirection.clientToServer,t.type=new on.ProtocolNotificationType(t.method)})(oR||(yr.DidDeleteFilesNotification=oR={}));var sR;(function(t){t.method="workspace/willDeleteFiles",t.messageDirection=on.MessageDirection.clientToServer,t.type=new on.ProtocolRequestType(t.method)})(sR||(yr.WillDeleteFilesRequest=sR={}))});var dR=Q($i=>{"use strict";Object.defineProperty($i,"__esModule",{value:!0});$i.MonikerRequest=$i.MonikerKind=$i.UniquenessLevel=void 0;var lR=ft(),uR;(function(t){t.document="document",t.project="project",t.group="group",t.scheme="scheme",t.global="global"})(uR||($i.UniquenessLevel=uR={}));var cR;(function(t){t.$import="import",t.$export="export",t.local="local"})(cR||($i.MonikerKind=cR={}));var fR;(function(t){t.method="textDocument/moniker",t.messageDirection=lR.MessageDirection.clientToServer,t.type=new lR.ProtocolRequestType(t.method)})(fR||($i.MonikerRequest=fR={}))});var gR=Q(Pi=>{"use strict";Object.defineProperty(Pi,"__esModule",{value:!0});Pi.TypeHierarchySubtypesRequest=Pi.TypeHierarchySupertypesRequest=Pi.TypeHierarchyPrepareRequest=void 0;var Cs=ft(),pR;(function(t){t.method="textDocument/prepareTypeHierarchy",t.messageDirection=Cs.MessageDirection.clientToServer,t.type=new Cs.ProtocolRequestType(t.method)})(pR||(Pi.TypeHierarchyPrepareRequest=pR={}));var mR;(function(t){t.method="typeHierarchy/supertypes",t.messageDirection=Cs.MessageDirection.clientToServer,t.type=new Cs.ProtocolRequestType(t.method)})(mR||(Pi.TypeHierarchySupertypesRequest=mR={}));var hR;(function(t){t.method="typeHierarchy/subtypes",t.messageDirection=Cs.MessageDirection.clientToServer,t.type=new Cs.ProtocolRequestType(t.method)})(hR||(Pi.TypeHierarchySubtypesRequest=hR={}))});var _R=Q(bs=>{"use strict";Object.defineProperty(bs,"__esModule",{value:!0});bs.InlineValueRefreshRequest=bs.InlineValueRequest=void 0;var Cc=ft(),TR;(function(t){t.method="textDocument/inlineValue",t.messageDirection=Cc.MessageDirection.clientToServer,t.type=new Cc.ProtocolRequestType(t.method)})(TR||(bs.InlineValueRequest=TR={}));var yR;(function(t){t.method="workspace/inlineValue/refresh",t.messageDirection=Cc.MessageDirection.serverToClient,t.type=new Cc.ProtocolRequestType0(t.method)})(yR||(bs.InlineValueRefreshRequest=yR={}))});var NR=Q(Mi=>{"use strict";Object.defineProperty(Mi,"__esModule",{value:!0});Mi.InlayHintRefreshRequest=Mi.InlayHintResolveRequest=Mi.InlayHintRequest=void 0;var Ls=ft(),vR;(function(t){t.method="textDocument/inlayHint",t.messageDirection=Ls.MessageDirection.clientToServer,t.type=new Ls.ProtocolRequestType(t.method)})(vR||(Mi.InlayHintRequest=vR={}));var RR;(function(t){t.method="inlayHint/resolve",t.messageDirection=Ls.MessageDirection.clientToServer,t.type=new Ls.ProtocolRequestType(t.method)})(RR||(Mi.InlayHintResolveRequest=RR={}));var xR;(function(t){t.method="workspace/inlayHint/refresh",t.messageDirection=Ls.MessageDirection.serverToClient,t.type=new Ls.ProtocolRequestType0(t.method)})(xR||(Mi.InlayHintRefreshRequest=xR={}))});var CR=Q(sn=>{"use strict";Object.defineProperty(sn,"__esModule",{value:!0});sn.DiagnosticRefreshRequest=sn.WorkspaceDiagnosticRequest=sn.DocumentDiagnosticRequest=sn.DocumentDiagnosticReportKind=sn.DiagnosticServerCancellationData=void 0;var DR=vo(),$L=yc(),ks=ft(),ER;(function(t){function e(r){let n=r;return n&&$L.boolean(n.retriggerRequest)}t.is=e})(ER||(sn.DiagnosticServerCancellationData=ER={}));var IR;(function(t){t.Full="full",t.Unchanged="unchanged"})(IR||(sn.DocumentDiagnosticReportKind=IR={}));var OR;(function(t){t.method="textDocument/diagnostic",t.messageDirection=ks.MessageDirection.clientToServer,t.type=new ks.ProtocolRequestType(t.method),t.partialResult=new DR.ProgressType})(OR||(sn.DocumentDiagnosticRequest=OR={}));var AR;(function(t){t.method="workspace/diagnostic",t.messageDirection=ks.MessageDirection.clientToServer,t.type=new ks.ProtocolRequestType(t.method),t.partialResult=new DR.ProgressType})(AR||(sn.WorkspaceDiagnosticRequest=AR={}));var SR;(function(t){t.method="workspace/diagnostic/refresh",t.messageDirection=ks.MessageDirection.serverToClient,t.type=new ks.ProtocolRequestType0(t.method)})(SR||(sn.DiagnosticRefreshRequest=SR={}))});var MR=Q(Dt=>{"use strict";Object.defineProperty(Dt,"__esModule",{value:!0});Dt.DidCloseNotebookDocumentNotification=Dt.DidSaveNotebookDocumentNotification=Dt.DidChangeNotebookDocumentNotification=Dt.NotebookCellArrayChange=Dt.DidOpenNotebookDocumentNotification=Dt.NotebookDocumentSyncRegistrationType=Dt.NotebookDocument=Dt.NotebookCell=Dt.ExecutionSummary=Dt.NotebookCellKind=void 0;var fl=Tc(),Rn=yc(),$n=ft(),gh;(function(t){t.Markup=1,t.Code=2;function e(r){return r===1||r===2}t.is=e})(gh||(Dt.NotebookCellKind=gh={}));var Th;(function(t){function e(i,o){let s={executionOrder:i};return(o===!0||o===!1)&&(s.success=o),s}t.create=e;function r(i){let o=i;return Rn.objectLiteral(o)&&fl.uinteger.is(o.executionOrder)&&(o.success===void 0||Rn.boolean(o.success))}t.is=r;function n(i,o){return i===o?!0:i==null||o===null||o===void 0?!1:i.executionOrder===o.executionOrder&&i.success===o.success}t.equals=n})(Th||(Dt.ExecutionSummary=Th={}));var bc;(function(t){function e(o,s){return{kind:o,document:s}}t.create=e;function r(o){let s=o;return Rn.objectLiteral(s)&&gh.is(s.kind)&&fl.DocumentUri.is(s.document)&&(s.metadata===void 0||Rn.objectLiteral(s.metadata))}t.is=r;function n(o,s){let a=new Set;return o.document!==s.document&&a.add("document"),o.kind!==s.kind&&a.add("kind"),o.executionSummary!==s.executionSummary&&a.add("executionSummary"),(o.metadata!==void 0||s.metadata!==void 0)&&!i(o.metadata,s.metadata)&&a.add("metadata"),(o.executionSummary!==void 0||s.executionSummary!==void 0)&&!Th.equals(o.executionSummary,s.executionSummary)&&a.add("executionSummary"),a}t.diff=n;function i(o,s){if(o===s)return!0;if(o==null||s===null||s===void 0||typeof o!=typeof s||typeof o!="object")return!1;let a=Array.isArray(o),l=Array.isArray(s);if(a!==l)return!1;if(a&&l){if(o.length!==s.length)return!1;for(let u=0;u<o.length;u++)if(!i(o[u],s[u]))return!1}if(Rn.objectLiteral(o)&&Rn.objectLiteral(s)){let u=Object.keys(o),c=Object.keys(s);if(u.length!==c.length||(u.sort(),c.sort(),!i(u,c)))return!1;for(let f=0;f<u.length;f++){let d=u[f];if(!i(o[d],s[d]))return!1}}return!0}})(bc||(Dt.NotebookCell=bc={}));var bR;(function(t){function e(n,i,o,s){return{uri:n,notebookType:i,version:o,cells:s}}t.create=e;function r(n){let i=n;return Rn.objectLiteral(i)&&Rn.string(i.uri)&&fl.integer.is(i.version)&&Rn.typedArray(i.cells,bc.is)}t.is=r})(bR||(Dt.NotebookDocument=bR={}));var ws;(function(t){t.method="notebookDocument/sync",t.messageDirection=$n.MessageDirection.clientToServer,t.type=new $n.RegistrationType(t.method)})(ws||(Dt.NotebookDocumentSyncRegistrationType=ws={}));var LR;(function(t){t.method="notebookDocument/didOpen",t.messageDirection=$n.MessageDirection.clientToServer,t.type=new $n.ProtocolNotificationType(t.method),t.registrationMethod=ws.method})(LR||(Dt.DidOpenNotebookDocumentNotification=LR={}));var kR;(function(t){function e(n){let i=n;return Rn.objectLiteral(i)&&fl.uinteger.is(i.start)&&fl.uinteger.is(i.deleteCount)&&(i.cells===void 0||Rn.typedArray(i.cells,bc.is))}t.is=e;function r(n,i,o){let s={start:n,deleteCount:i};return o!==void 0&&(s.cells=o),s}t.create=r})(kR||(Dt.NotebookCellArrayChange=kR={}));var wR;(function(t){t.method="notebookDocument/didChange",t.messageDirection=$n.MessageDirection.clientToServer,t.type=new $n.ProtocolNotificationType(t.method),t.registrationMethod=ws.method})(wR||(Dt.DidChangeNotebookDocumentNotification=wR={}));var $R;(function(t){t.method="notebookDocument/didSave",t.messageDirection=$n.MessageDirection.clientToServer,t.type=new $n.ProtocolNotificationType(t.method),t.registrationMethod=ws.method})($R||(Dt.DidSaveNotebookDocumentNotification=$R={}));var PR;(function(t){t.method="notebookDocument/didClose",t.messageDirection=$n.MessageDirection.clientToServer,t.type=new $n.ProtocolNotificationType(t.method),t.registrationMethod=ws.method})(PR||(Dt.DidCloseNotebookDocumentNotification=PR={}))});var VR=Q(Lc=>{"use strict";Object.defineProperty(Lc,"__esModule",{value:!0});Lc.InlineCompletionRequest=void 0;var FR=ft(),UR;(function(t){t.method="textDocument/inlineCompletion",t.messageDirection=FR.MessageDirection.clientToServer,t.type=new FR.ProtocolRequestType(t.method)})(UR||(Lc.InlineCompletionRequest=UR={}))});var Zx=Q(v=>{"use strict";Object.defineProperty(v,"__esModule",{value:!0});v.WorkspaceSymbolRequest=v.CodeActionResolveRequest=v.CodeActionRequest=v.DocumentSymbolRequest=v.DocumentHighlightRequest=v.ReferencesRequest=v.DefinitionRequest=v.SignatureHelpRequest=v.SignatureHelpTriggerKind=v.HoverRequest=v.CompletionResolveRequest=v.CompletionRequest=v.CompletionTriggerKind=v.PublishDiagnosticsNotification=v.WatchKind=v.RelativePattern=v.FileChangeType=v.DidChangeWatchedFilesNotification=v.WillSaveTextDocumentWaitUntilRequest=v.WillSaveTextDocumentNotification=v.TextDocumentSaveReason=v.DidSaveTextDocumentNotification=v.DidCloseTextDocumentNotification=v.DidChangeTextDocumentNotification=v.TextDocumentContentChangeEvent=v.DidOpenTextDocumentNotification=v.TextDocumentSyncKind=v.TelemetryEventNotification=v.LogMessageNotification=v.ShowMessageRequest=v.ShowMessageNotification=v.MessageType=v.DidChangeConfigurationNotification=v.ExitNotification=v.ShutdownRequest=v.InitializedNotification=v.InitializeErrorCodes=v.InitializeRequest=v.WorkDoneProgressOptions=v.TextDocumentRegistrationOptions=v.StaticRegistrationOptions=v.PositionEncodingKind=v.FailureHandlingKind=v.ResourceOperationKind=v.UnregistrationRequest=v.RegistrationRequest=v.DocumentSelector=v.NotebookCellTextDocumentFilter=v.NotebookDocumentFilter=v.TextDocumentFilter=void 0;v.MonikerRequest=v.MonikerKind=v.UniquenessLevel=v.WillDeleteFilesRequest=v.DidDeleteFilesNotification=v.WillRenameFilesRequest=v.DidRenameFilesNotification=v.WillCreateFilesRequest=v.DidCreateFilesNotification=v.FileOperationPatternKind=v.LinkedEditingRangeRequest=v.ShowDocumentRequest=v.SemanticTokensRegistrationType=v.SemanticTokensRefreshRequest=v.SemanticTokensRangeRequest=v.SemanticTokensDeltaRequest=v.SemanticTokensRequest=v.TokenFormat=v.CallHierarchyPrepareRequest=v.CallHierarchyOutgoingCallsRequest=v.CallHierarchyIncomingCallsRequest=v.WorkDoneProgressCancelNotification=v.WorkDoneProgressCreateRequest=v.WorkDoneProgress=v.SelectionRangeRequest=v.DeclarationRequest=v.FoldingRangeRefreshRequest=v.FoldingRangeRequest=v.ColorPresentationRequest=v.DocumentColorRequest=v.ConfigurationRequest=v.DidChangeWorkspaceFoldersNotification=v.WorkspaceFoldersRequest=v.TypeDefinitionRequest=v.ImplementationRequest=v.ApplyWorkspaceEditRequest=v.ExecuteCommandRequest=v.PrepareRenameRequest=v.RenameRequest=v.PrepareSupportDefaultBehavior=v.DocumentOnTypeFormattingRequest=v.DocumentRangesFormattingRequest=v.DocumentRangeFormattingRequest=v.DocumentFormattingRequest=v.DocumentLinkResolveRequest=v.DocumentLinkRequest=v.CodeLensRefreshRequest=v.CodeLensResolveRequest=v.CodeLensRequest=v.WorkspaceSymbolResolveRequest=void 0;v.InlineCompletionRequest=v.DidCloseNotebookDocumentNotification=v.DidSaveNotebookDocumentNotification=v.DidChangeNotebookDocumentNotification=v.NotebookCellArrayChange=v.DidOpenNotebookDocumentNotification=v.NotebookDocumentSyncRegistrationType=v.NotebookDocument=v.NotebookCell=v.ExecutionSummary=v.NotebookCellKind=v.DiagnosticRefreshRequest=v.WorkspaceDiagnosticRequest=v.DocumentDiagnosticRequest=v.DocumentDiagnosticReportKind=v.DiagnosticServerCancellationData=v.InlayHintRefreshRequest=v.InlayHintResolveRequest=v.InlayHintRequest=v.InlineValueRefreshRequest=v.InlineValueRequest=v.TypeHierarchySupertypesRequest=v.TypeHierarchySubtypesRequest=v.TypeHierarchyPrepareRequest=void 0;var H=ft(),BR=Tc(),tr=yc(),PL=dv();Object.defineProperty(v,"ImplementationRequest",{enumerable:!0,get:function(){return PL.ImplementationRequest}});var ML=hv();Object.defineProperty(v,"TypeDefinitionRequest",{enumerable:!0,get:function(){return ML.TypeDefinitionRequest}});var Yx=yv();Object.defineProperty(v,"WorkspaceFoldersRequest",{enumerable:!0,get:function(){return Yx.WorkspaceFoldersRequest}});Object.defineProperty(v,"DidChangeWorkspaceFoldersNotification",{enumerable:!0,get:function(){return Yx.DidChangeWorkspaceFoldersNotification}});var FL=Rv();Object.defineProperty(v,"ConfigurationRequest",{enumerable:!0,get:function(){return FL.ConfigurationRequest}});var Xx=Ev();Object.defineProperty(v,"DocumentColorRequest",{enumerable:!0,get:function(){return Xx.DocumentColorRequest}});Object.defineProperty(v,"ColorPresentationRequest",{enumerable:!0,get:function(){return Xx.ColorPresentationRequest}});var Jx=Av();Object.defineProperty(v,"FoldingRangeRequest",{enumerable:!0,get:function(){return Jx.FoldingRangeRequest}});Object.defineProperty(v,"FoldingRangeRefreshRequest",{enumerable:!0,get:function(){return Jx.FoldingRangeRefreshRequest}});var UL=Cv();Object.defineProperty(v,"DeclarationRequest",{enumerable:!0,get:function(){return UL.DeclarationRequest}});var VL=kv();Object.defineProperty(v,"SelectionRangeRequest",{enumerable:!0,get:function(){return VL.SelectionRangeRequest}});var xh=Mv();Object.defineProperty(v,"WorkDoneProgress",{enumerable:!0,get:function(){return xh.WorkDoneProgress}});Object.defineProperty(v,"WorkDoneProgressCreateRequest",{enumerable:!0,get:function(){return xh.WorkDoneProgressCreateRequest}});Object.defineProperty(v,"WorkDoneProgressCancelNotification",{enumerable:!0,get:function(){return xh.WorkDoneProgressCancelNotification}});var Nh=Bv();Object.defineProperty(v,"CallHierarchyIncomingCallsRequest",{enumerable:!0,get:function(){return Nh.CallHierarchyIncomingCallsRequest}});Object.defineProperty(v,"CallHierarchyOutgoingCallsRequest",{enumerable:!0,get:function(){return Nh.CallHierarchyOutgoingCallsRequest}});Object.defineProperty(v,"CallHierarchyPrepareRequest",{enumerable:!0,get:function(){return Nh.CallHierarchyPrepareRequest}});var $s=Kv();Object.defineProperty(v,"TokenFormat",{enumerable:!0,get:function(){return $s.TokenFormat}});Object.defineProperty(v,"SemanticTokensRequest",{enumerable:!0,get:function(){return $s.SemanticTokensRequest}});Object.defineProperty(v,"SemanticTokensDeltaRequest",{enumerable:!0,get:function(){return $s.SemanticTokensDeltaRequest}});Object.defineProperty(v,"SemanticTokensRangeRequest",{enumerable:!0,get:function(){return $s.SemanticTokensRangeRequest}});Object.defineProperty(v,"SemanticTokensRefreshRequest",{enumerable:!0,get:function(){return $s.SemanticTokensRefreshRequest}});Object.defineProperty(v,"SemanticTokensRegistrationType",{enumerable:!0,get:function(){return $s.SemanticTokensRegistrationType}});var BL=Xv();Object.defineProperty(v,"ShowDocumentRequest",{enumerable:!0,get:function(){return BL.ShowDocumentRequest}});var WL=Zv();Object.defineProperty(v,"LinkedEditingRangeRequest",{enumerable:!0,get:function(){return WL.LinkedEditingRangeRequest}});var Ro=aR();Object.defineProperty(v,"FileOperationPatternKind",{enumerable:!0,get:function(){return Ro.FileOperationPatternKind}});Object.defineProperty(v,"DidCreateFilesNotification",{enumerable:!0,get:function(){return Ro.DidCreateFilesNotification}});Object.defineProperty(v,"WillCreateFilesRequest",{enumerable:!0,get:function(){return Ro.WillCreateFilesRequest}});Object.defineProperty(v,"DidRenameFilesNotification",{enumerable:!0,get:function(){return Ro.DidRenameFilesNotification}});Object.defineProperty(v,"WillRenameFilesRequest",{enumerable:!0,get:function(){return Ro.WillRenameFilesRequest}});Object.defineProperty(v,"DidDeleteFilesNotification",{enumerable:!0,get:function(){return Ro.DidDeleteFilesNotification}});Object.defineProperty(v,"WillDeleteFilesRequest",{enumerable:!0,get:function(){return Ro.WillDeleteFilesRequest}});var Eh=dR();Object.defineProperty(v,"UniquenessLevel",{enumerable:!0,get:function(){return Eh.UniquenessLevel}});Object.defineProperty(v,"MonikerKind",{enumerable:!0,get:function(){return Eh.MonikerKind}});Object.defineProperty(v,"MonikerRequest",{enumerable:!0,get:function(){return Eh.MonikerRequest}});var Ih=gR();Object.defineProperty(v,"TypeHierarchyPrepareRequest",{enumerable:!0,get:function(){return Ih.TypeHierarchyPrepareRequest}});Object.defineProperty(v,"TypeHierarchySubtypesRequest",{enumerable:!0,get:function(){return Ih.TypeHierarchySubtypesRequest}});Object.defineProperty(v,"TypeHierarchySupertypesRequest",{enumerable:!0,get:function(){return Ih.TypeHierarchySupertypesRequest}});var Qx=_R();Object.defineProperty(v,"InlineValueRequest",{enumerable:!0,get:function(){return Qx.InlineValueRequest}});Object.defineProperty(v,"InlineValueRefreshRequest",{enumerable:!0,get:function(){return Qx.InlineValueRefreshRequest}});var Oh=NR();Object.defineProperty(v,"InlayHintRequest",{enumerable:!0,get:function(){return Oh.InlayHintRequest}});Object.defineProperty(v,"InlayHintResolveRequest",{enumerable:!0,get:function(){return Oh.InlayHintResolveRequest}});Object.defineProperty(v,"InlayHintRefreshRequest",{enumerable:!0,get:function(){return Oh.InlayHintRefreshRequest}});var dl=CR();Object.defineProperty(v,"DiagnosticServerCancellationData",{enumerable:!0,get:function(){return dl.DiagnosticServerCancellationData}});Object.defineProperty(v,"DocumentDiagnosticReportKind",{enumerable:!0,get:function(){return dl.DocumentDiagnosticReportKind}});Object.defineProperty(v,"DocumentDiagnosticRequest",{enumerable:!0,get:function(){return dl.DocumentDiagnosticRequest}});Object.defineProperty(v,"WorkspaceDiagnosticRequest",{enumerable:!0,get:function(){return dl.WorkspaceDiagnosticRequest}});Object.defineProperty(v,"DiagnosticRefreshRequest",{enumerable:!0,get:function(){return dl.DiagnosticRefreshRequest}});var Pn=MR();Object.defineProperty(v,"NotebookCellKind",{enumerable:!0,get:function(){return Pn.NotebookCellKind}});Object.defineProperty(v,"ExecutionSummary",{enumerable:!0,get:function(){return Pn.ExecutionSummary}});Object.defineProperty(v,"NotebookCell",{enumerable:!0,get:function(){return Pn.NotebookCell}});Object.defineProperty(v,"NotebookDocument",{enumerable:!0,get:function(){return Pn.NotebookDocument}});Object.defineProperty(v,"NotebookDocumentSyncRegistrationType",{enumerable:!0,get:function(){return Pn.NotebookDocumentSyncRegistrationType}});Object.defineProperty(v,"DidOpenNotebookDocumentNotification",{enumerable:!0,get:function(){return Pn.DidOpenNotebookDocumentNotification}});Object.defineProperty(v,"NotebookCellArrayChange",{enumerable:!0,get:function(){return Pn.NotebookCellArrayChange}});Object.defineProperty(v,"DidChangeNotebookDocumentNotification",{enumerable:!0,get:function(){return Pn.DidChangeNotebookDocumentNotification}});Object.defineProperty(v,"DidSaveNotebookDocumentNotification",{enumerable:!0,get:function(){return Pn.DidSaveNotebookDocumentNotification}});Object.defineProperty(v,"DidCloseNotebookDocumentNotification",{enumerable:!0,get:function(){return Pn.DidCloseNotebookDocumentNotification}});var GL=VR();Object.defineProperty(v,"InlineCompletionRequest",{enumerable:!0,get:function(){return GL.InlineCompletionRequest}});var yh;(function(t){function e(r){let n=r;return tr.string(n)||tr.string(n.language)||tr.string(n.scheme)||tr.string(n.pattern)}t.is=e})(yh||(v.TextDocumentFilter=yh={}));var _h;(function(t){function e(r){let n=r;return tr.objectLiteral(n)&&(tr.string(n.notebookType)||tr.string(n.scheme)||tr.string(n.pattern))}t.is=e})(_h||(v.NotebookDocumentFilter=_h={}));var vh;(function(t){function e(r){let n=r;return tr.objectLiteral(n)&&(tr.string(n.notebook)||_h.is(n.notebook))&&(n.language===void 0||tr.string(n.language))}t.is=e})(vh||(v.NotebookCellTextDocumentFilter=vh={}));var Rh;(function(t){function e(r){if(!Array.isArray(r))return!1;for(let n of r)if(!tr.string(n)&&!yh.is(n)&&!vh.is(n))return!1;return!0}t.is=e})(Rh||(v.DocumentSelector=Rh={}));var WR;(function(t){t.method="client/registerCapability",t.messageDirection=H.MessageDirection.serverToClient,t.type=new H.ProtocolRequestType(t.method)})(WR||(v.RegistrationRequest=WR={}));var GR;(function(t){t.method="client/unregisterCapability",t.messageDirection=H.MessageDirection.serverToClient,t.type=new H.ProtocolRequestType(t.method)})(GR||(v.UnregistrationRequest=GR={}));var jR;(function(t){t.Create="create",t.Rename="rename",t.Delete="delete"})(jR||(v.ResourceOperationKind=jR={}));var qR;(function(t){t.Abort="abort",t.Transactional="transactional",t.TextOnlyTransactional="textOnlyTransactional",t.Undo="undo"})(qR||(v.FailureHandlingKind=qR={}));var HR;(function(t){t.UTF8="utf-8",t.UTF16="utf-16",t.UTF32="utf-32"})(HR||(v.PositionEncodingKind=HR={}));var KR;(function(t){function e(r){let n=r;return n&&tr.string(n.id)&&n.id.length>0}t.hasId=e})(KR||(v.StaticRegistrationOptions=KR={}));var zR;(function(t){function e(r){let n=r;return n&&(n.documentSelector===null||Rh.is(n.documentSelector))}t.is=e})(zR||(v.TextDocumentRegistrationOptions=zR={}));var YR;(function(t){function e(n){let i=n;return tr.objectLiteral(i)&&(i.workDoneProgress===void 0||tr.boolean(i.workDoneProgress))}t.is=e;function r(n){let i=n;return i&&tr.boolean(i.workDoneProgress)}t.hasWorkDoneProgress=r})(YR||(v.WorkDoneProgressOptions=YR={}));var XR;(function(t){t.method="initialize",t.messageDirection=H.MessageDirection.clientToServer,t.type=new H.ProtocolRequestType(t.method)})(XR||(v.InitializeRequest=XR={}));var JR;(function(t){t.unknownProtocolVersion=1})(JR||(v.InitializeErrorCodes=JR={}));var QR;(function(t){t.method="initialized",t.messageDirection=H.MessageDirection.clientToServer,t.type=new H.ProtocolNotificationType(t.method)})(QR||(v.InitializedNotification=QR={}));var ZR;(function(t){t.method="shutdown",t.messageDirection=H.MessageDirection.clientToServer,t.type=new H.ProtocolRequestType0(t.method)})(ZR||(v.ShutdownRequest=ZR={}));var ex;(function(t){t.method="exit",t.messageDirection=H.MessageDirection.clientToServer,t.type=new H.ProtocolNotificationType0(t.method)})(ex||(v.ExitNotification=ex={}));var tx;(function(t){t.method="workspace/didChangeConfiguration",t.messageDirection=H.MessageDirection.clientToServer,t.type=new H.ProtocolNotificationType(t.method)})(tx||(v.DidChangeConfigurationNotification=tx={}));var rx;(function(t){t.Error=1,t.Warning=2,t.Info=3,t.Log=4,t.Debug=5})(rx||(v.MessageType=rx={}));var nx;(function(t){t.method="window/showMessage",t.messageDirection=H.MessageDirection.serverToClient,t.type=new H.ProtocolNotificationType(t.method)})(nx||(v.ShowMessageNotification=nx={}));var ix;(function(t){t.method="window/showMessageRequest",t.messageDirection=H.MessageDirection.serverToClient,t.type=new H.ProtocolRequestType(t.method)})(ix||(v.ShowMessageRequest=ix={}));var ox;(function(t){t.method="window/logMessage",t.messageDirection=H.MessageDirection.serverToClient,t.type=new H.ProtocolNotificationType(t.method)})(ox||(v.LogMessageNotification=ox={}));var sx;(function(t){t.method="telemetry/event",t.messageDirection=H.MessageDirection.serverToClient,t.type=new H.ProtocolNotificationType(t.method)})(sx||(v.TelemetryEventNotification=sx={}));var ax;(function(t){t.None=0,t.Full=1,t.Incremental=2})(ax||(v.TextDocumentSyncKind=ax={}));var lx;(function(t){t.method="textDocument/didOpen",t.messageDirection=H.MessageDirection.clientToServer,t.type=new H.ProtocolNotificationType(t.method)})(lx||(v.DidOpenTextDocumentNotification=lx={}));var ux;(function(t){function e(n){let i=n;return i!=null&&typeof i.text=="string"&&i.range!==void 0&&(i.rangeLength===void 0||typeof i.rangeLength=="number")}t.isIncremental=e;function r(n){let i=n;return i!=null&&typeof i.text=="string"&&i.range===void 0&&i.rangeLength===void 0}t.isFull=r})(ux||(v.TextDocumentContentChangeEvent=ux={}));var cx;(function(t){t.method="textDocument/didChange",t.messageDirection=H.MessageDirection.clientToServer,t.type=new H.ProtocolNotificationType(t.method)})(cx||(v.DidChangeTextDocumentNotification=cx={}));var fx;(function(t){t.method="textDocument/didClose",t.messageDirection=H.MessageDirection.clientToServer,t.type=new H.ProtocolNotificationType(t.method)})(fx||(v.DidCloseTextDocumentNotification=fx={}));var dx;(function(t){t.method="textDocument/didSave",t.messageDirection=H.MessageDirection.clientToServer,t.type=new H.ProtocolNotificationType(t.method)})(dx||(v.DidSaveTextDocumentNotification=dx={}));var px;(function(t){t.Manual=1,t.AfterDelay=2,t.FocusOut=3})(px||(v.TextDocumentSaveReason=px={}));var mx;(function(t){t.method="textDocument/willSave",t.messageDirection=H.MessageDirection.clientToServer,t.type=new H.ProtocolNotificationType(t.method)})(mx||(v.WillSaveTextDocumentNotification=mx={}));var hx;(function(t){t.method="textDocument/willSaveWaitUntil",t.messageDirection=H.MessageDirection.clientToServer,t.type=new H.ProtocolRequestType(t.method)})(hx||(v.WillSaveTextDocumentWaitUntilRequest=hx={}));var gx;(function(t){t.method="workspace/didChangeWatchedFiles",t.messageDirection=H.MessageDirection.clientToServer,t.type=new H.ProtocolNotificationType(t.method)})(gx||(v.DidChangeWatchedFilesNotification=gx={}));var Tx;(function(t){t.Created=1,t.Changed=2,t.Deleted=3})(Tx||(v.FileChangeType=Tx={}));var yx;(function(t){function e(r){let n=r;return tr.objectLiteral(n)&&(BR.URI.is(n.baseUri)||BR.WorkspaceFolder.is(n.baseUri))&&tr.string(n.pattern)}t.is=e})(yx||(v.RelativePattern=yx={}));var _x;(function(t){t.Create=1,t.Change=2,t.Delete=4})(_x||(v.WatchKind=_x={}));var vx;(function(t){t.method="textDocument/publishDiagnostics",t.messageDirection=H.MessageDirection.serverToClient,t.type=new H.ProtocolNotificationType(t.method)})(vx||(v.PublishDiagnosticsNotification=vx={}));var Rx;(function(t){t.Invoked=1,t.TriggerCharacter=2,t.TriggerForIncompleteCompletions=3})(Rx||(v.CompletionTriggerKind=Rx={}));var xx;(function(t){t.method="textDocument/completion",t.messageDirection=H.MessageDirection.clientToServer,t.type=new H.ProtocolRequestType(t.method)})(xx||(v.CompletionRequest=xx={}));var Nx;(function(t){t.method="completionItem/resolve",t.messageDirection=H.MessageDirection.clientToServer,t.type=new H.ProtocolRequestType(t.method)})(Nx||(v.CompletionResolveRequest=Nx={}));var Ex;(function(t){t.method="textDocument/hover",t.messageDirection=H.MessageDirection.clientToServer,t.type=new H.ProtocolRequestType(t.method)})(Ex||(v.HoverRequest=Ex={}));var Ix;(function(t){t.Invoked=1,t.TriggerCharacter=2,t.ContentChange=3})(Ix||(v.SignatureHelpTriggerKind=Ix={}));var Ox;(function(t){t.method="textDocument/signatureHelp",t.messageDirection=H.MessageDirection.clientToServer,t.type=new H.ProtocolRequestType(t.method)})(Ox||(v.SignatureHelpRequest=Ox={}));var Ax;(function(t){t.method="textDocument/definition",t.messageDirection=H.MessageDirection.clientToServer,t.type=new H.ProtocolRequestType(t.method)})(Ax||(v.DefinitionRequest=Ax={}));var Sx;(function(t){t.method="textDocument/references",t.messageDirection=H.MessageDirection.clientToServer,t.type=new H.ProtocolRequestType(t.method)})(Sx||(v.ReferencesRequest=Sx={}));var Dx;(function(t){t.method="textDocument/documentHighlight",t.messageDirection=H.MessageDirection.clientToServer,t.type=new H.ProtocolRequestType(t.method)})(Dx||(v.DocumentHighlightRequest=Dx={}));var Cx;(function(t){t.method="textDocument/documentSymbol",t.messageDirection=H.MessageDirection.clientToServer,t.type=new H.ProtocolRequestType(t.method)})(Cx||(v.DocumentSymbolRequest=Cx={}));var bx;(function(t){t.method="textDocument/codeAction",t.messageDirection=H.MessageDirection.clientToServer,t.type=new H.ProtocolRequestType(t.method)})(bx||(v.CodeActionRequest=bx={}));var Lx;(function(t){t.method="codeAction/resolve",t.messageDirection=H.MessageDirection.clientToServer,t.type=new H.ProtocolRequestType(t.method)})(Lx||(v.CodeActionResolveRequest=Lx={}));var kx;(function(t){t.method="workspace/symbol",t.messageDirection=H.MessageDirection.clientToServer,t.type=new H.ProtocolRequestType(t.method)})(kx||(v.WorkspaceSymbolRequest=kx={}));var wx;(function(t){t.method="workspaceSymbol/resolve",t.messageDirection=H.MessageDirection.clientToServer,t.type=new H.ProtocolRequestType(t.method)})(wx||(v.WorkspaceSymbolResolveRequest=wx={}));var $x;(function(t){t.method="textDocument/codeLens",t.messageDirection=H.MessageDirection.clientToServer,t.type=new H.ProtocolRequestType(t.method)})($x||(v.CodeLensRequest=$x={}));var Px;(function(t){t.method="codeLens/resolve",t.messageDirection=H.MessageDirection.clientToServer,t.type=new H.ProtocolRequestType(t.method)})(Px||(v.CodeLensResolveRequest=Px={}));var Mx;(function(t){t.method="workspace/codeLens/refresh",t.messageDirection=H.MessageDirection.serverToClient,t.type=new H.ProtocolRequestType0(t.method)})(Mx||(v.CodeLensRefreshRequest=Mx={}));var Fx;(function(t){t.method="textDocument/documentLink",t.messageDirection=H.MessageDirection.clientToServer,t.type=new H.ProtocolRequestType(t.method)})(Fx||(v.DocumentLinkRequest=Fx={}));var Ux;(function(t){t.method="documentLink/resolve",t.messageDirection=H.MessageDirection.clientToServer,t.type=new H.ProtocolRequestType(t.method)})(Ux||(v.DocumentLinkResolveRequest=Ux={}));var Vx;(function(t){t.method="textDocument/formatting",t.messageDirection=H.MessageDirection.clientToServer,t.type=new H.ProtocolRequestType(t.method)})(Vx||(v.DocumentFormattingRequest=Vx={}));var Bx;(function(t){t.method="textDocument/rangeFormatting",t.messageDirection=H.MessageDirection.clientToServer,t.type=new H.ProtocolRequestType(t.method)})(Bx||(v.DocumentRangeFormattingRequest=Bx={}));var Wx;(function(t){t.method="textDocument/rangesFormatting",t.messageDirection=H.MessageDirection.clientToServer,t.type=new H.ProtocolRequestType(t.method)})(Wx||(v.DocumentRangesFormattingRequest=Wx={}));var Gx;(function(t){t.method="textDocument/onTypeFormatting",t.messageDirection=H.MessageDirection.clientToServer,t.type=new H.ProtocolRequestType(t.method)})(Gx||(v.DocumentOnTypeFormattingRequest=Gx={}));var jx;(function(t){t.Identifier=1})(jx||(v.PrepareSupportDefaultBehavior=jx={}));var qx;(function(t){t.method="textDocument/rename",t.messageDirection=H.MessageDirection.clientToServer,t.type=new H.ProtocolRequestType(t.method)})(qx||(v.RenameRequest=qx={}));var Hx;(function(t){t.method="textDocument/prepareRename",t.messageDirection=H.MessageDirection.clientToServer,t.type=new H.ProtocolRequestType(t.method)})(Hx||(v.PrepareRenameRequest=Hx={}));var Kx;(function(t){t.method="workspace/executeCommand",t.messageDirection=H.MessageDirection.clientToServer,t.type=new H.ProtocolRequestType(t.method)})(Kx||(v.ExecuteCommandRequest=Kx={}));var zx;(function(t){t.method="workspace/applyEdit",t.messageDirection=H.MessageDirection.serverToClient,t.type=new H.ProtocolRequestType("workspace/applyEdit")})(zx||(v.ApplyWorkspaceEditRequest=zx={}))});var tN=Q(kc=>{"use strict";Object.defineProperty(kc,"__esModule",{value:!0});kc.createProtocolConnection=void 0;var eN=vo();function jL(t,e,r,n){return eN.ConnectionStrategy.is(n)&&(n={connectionStrategy:n}),(0,eN.createMessageConnection)(t,e,r,n)}kc.createProtocolConnection=jL});var nN=Q(Vr=>{"use strict";var qL=Vr&&Vr.__createBinding||(Object.create?function(t,e,r,n){n===void 0&&(n=r);var i=Object.getOwnPropertyDescriptor(e,r);(!i||("get"in i?!e.__esModule:i.writable||i.configurable))&&(i={enumerable:!0,get:function(){return e[r]}}),Object.defineProperty(t,n,i)}:function(t,e,r,n){n===void 0&&(n=r),t[n]=e[r]}),wc=Vr&&Vr.__exportStar||function(t,e){for(var r in t)r!=="default"&&!Object.prototype.hasOwnProperty.call(e,r)&&qL(e,t,r)};Object.defineProperty(Vr,"__esModule",{value:!0});Vr.LSPErrorCodes=Vr.createProtocolConnection=void 0;wc(vo(),Vr);wc(Tc(),Vr);wc(ft(),Vr);wc(Zx(),Vr);var HL=tN();Object.defineProperty(Vr,"createProtocolConnection",{enumerable:!0,get:function(){return HL.createProtocolConnection}});var rN;(function(t){t.lspReservedErrorRangeStart=-32899,t.RequestFailed=-32803,t.ServerCancelled=-32802,t.ContentModified=-32801,t.RequestCancelled=-32800,t.lspReservedErrorRangeEnd=-32800})(rN||(Vr.LSPErrorCodes=rN={}))});var vt=Q(Mn=>{"use strict";var KL=Mn&&Mn.__createBinding||(Object.create?function(t,e,r,n){n===void 0&&(n=r);var i=Object.getOwnPropertyDescriptor(e,r);(!i||("get"in i?!e.__esModule:i.writable||i.configurable))&&(i={enumerable:!0,get:function(){return e[r]}}),Object.defineProperty(t,n,i)}:function(t,e,r,n){n===void 0&&(n=r),t[n]=e[r]}),iN=Mn&&Mn.__exportStar||function(t,e){for(var r in t)r!=="default"&&!Object.prototype.hasOwnProperty.call(e,r)&&KL(e,t,r)};Object.defineProperty(Mn,"__esModule",{value:!0});Mn.createProtocolConnection=void 0;var zL=ch();iN(ch(),Mn);iN(nN(),Mn);function YL(t,e,r,n){return(0,zL.createMessageConnection)(t,e,r,n)}Mn.createProtocolConnection=YL});var Ah=Q(an=>{"use strict";Object.defineProperty(an,"__esModule",{value:!0});an.generateUuid=an.parse=an.isUUID=an.v4=an.empty=void 0;var pl=class{constructor(e){this._value=e}asHex(){return this._value}equals(e){return this.asHex()===e.asHex()}},ml=class t extends pl{static _oneOf(e){return e[Math.floor(e.length*Math.random())]}static _randomHex(){return t._oneOf(t._chars)}constructor(){super([t._randomHex(),t._randomHex(),t._randomHex(),t._randomHex(),t._randomHex(),t._randomHex(),t._randomHex(),t._randomHex(),"-",t._randomHex(),t._randomHex(),t._randomHex(),t._randomHex(),"-","4",t._randomHex(),t._randomHex(),t._randomHex(),"-",t._oneOf(t._timeHighBits),t._randomHex(),t._randomHex(),t._randomHex(),"-",t._randomHex(),t._randomHex(),t._randomHex(),t._randomHex(),t._randomHex(),t._randomHex(),t._randomHex(),t._randomHex(),t._randomHex(),t._randomHex(),t._randomHex(),t._randomHex()].join(""))}};ml._chars=["0","1","2","3","4","5","6","6","7","8","9","a","b","c","d","e","f"];ml._timeHighBits=["8","9","a","b"];an.empty=new pl("00000000-0000-0000-0000-000000000000");function oN(){return new ml}an.v4=oN;var XL=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;function sN(t){return XL.test(t)}an.isUUID=sN;function JL(t){if(!sN(t))throw new Error("invalid uuid");return new pl(t)}an.parse=JL;function QL(){return oN().asHex()}an.generateUuid=QL});var aN=Q(Ui=>{"use strict";Object.defineProperty(Ui,"__esModule",{value:!0});Ui.attachPartialResult=Ui.ProgressFeature=Ui.attachWorkDone=void 0;var Fi=vt(),ZL=Ah(),xo=class t{constructor(e,r){this._connection=e,this._token=r,t.Instances.set(this._token,this)}begin(e,r,n,i){let o={kind:"begin",title:e,percentage:r,message:n,cancellable:i};this._connection.sendProgress(Fi.WorkDoneProgress.type,this._token,o)}report(e,r){let n={kind:"report"};typeof e=="number"?(n.percentage=e,r!==void 0&&(n.message=r)):n.message=e,this._connection.sendProgress(Fi.WorkDoneProgress.type,this._token,n)}done(){t.Instances.delete(this._token),this._connection.sendProgress(Fi.WorkDoneProgress.type,this._token,{kind:"end"})}};xo.Instances=new Map;var $c=class extends xo{constructor(e,r){super(e,r),this._source=new Fi.CancellationTokenSource}get token(){return this._source.token}done(){this._source.dispose(),super.done()}cancel(){this._source.cancel()}},hl=class{constructor(){}begin(){}report(){}done(){}},Pc=class extends hl{constructor(){super(),this._source=new Fi.CancellationTokenSource}get token(){return this._source.token}done(){this._source.dispose()}cancel(){this._source.cancel()}};function ek(t,e){if(e===void 0||e.workDoneToken===void 0)return new hl;let r=e.workDoneToken;return delete e.workDoneToken,new xo(t,r)}Ui.attachWorkDone=ek;var tk=t=>class extends t{constructor(){super(),this._progressSupported=!1}initialize(e){var r;super.initialize(e),((r=e==null?void 0:e.window)==null?void 0:r.workDoneProgress)===!0&&(this._progressSupported=!0,this.connection.onNotification(Fi.WorkDoneProgressCancelNotification.type,n=>{let i=xo.Instances.get(n.token);(i instanceof $c||i instanceof Pc)&&i.cancel()}))}attachWorkDoneProgress(e){return e===void 0?new hl:new xo(this.connection,e)}createWorkDoneProgress(){if(this._progressSupported){let e=(0,ZL.generateUuid)();return this.connection.sendRequest(Fi.WorkDoneProgressCreateRequest.type,{token:e}).then(()=>new $c(this.connection,e))}else return Promise.resolve(new Pc)}};Ui.ProgressFeature=tk;var Sh;(function(t){t.type=new Fi.ProgressType})(Sh||(Sh={}));var Dh=class{constructor(e,r){this._connection=e,this._token=r}report(e){this._connection.sendProgress(Sh.type,this._token,e)}};function rk(t,e){if(e===void 0||e.partialResultToken===void 0)return;let r=e.partialResultToken;return delete e.partialResultToken,new Dh(t,r)}Ui.attachPartialResult=rk});var lN=Q(Mc=>{"use strict";Object.defineProperty(Mc,"__esModule",{value:!0});Mc.ConfigurationFeature=void 0;var nk=vt(),ik=zu(),ok=t=>class extends t{getConfiguration(e){return e?ik.string(e)?this._getConfiguration({section:e}):this._getConfiguration(e):this._getConfiguration({})}_getConfiguration(e){let r={items:Array.isArray(e)?e:[e]};return this.connection.sendRequest(nk.ConfigurationRequest.type,r).then(n=>Array.isArray(n)?Array.isArray(e)?n:n[0]:Array.isArray(e)?[]:null)}};Mc.ConfigurationFeature=ok});var uN=Q(Uc=>{"use strict";Object.defineProperty(Uc,"__esModule",{value:!0});Uc.WorkspaceFoldersFeature=void 0;var Fc=vt(),sk=t=>class extends t{constructor(){super(),this._notificationIsAutoRegistered=!1}initialize(e){super.initialize(e);let r=e.workspace;r&&r.workspaceFolders&&(this._onDidChangeWorkspaceFolders=new Fc.Emitter,this.connection.onNotification(Fc.DidChangeWorkspaceFoldersNotification.type,n=>{this._onDidChangeWorkspaceFolders.fire(n.event)}))}fillServerCapabilities(e){var n,i;super.fillServerCapabilities(e);let r=(i=(n=e.workspace)==null?void 0:n.workspaceFolders)==null?void 0:i.changeNotifications;this._notificationIsAutoRegistered=r===!0||typeof r=="string"}getWorkspaceFolders(){return this.connection.sendRequest(Fc.WorkspaceFoldersRequest.type)}get onDidChangeWorkspaceFolders(){if(!this._onDidChangeWorkspaceFolders)throw new Error("Client doesn't support sending workspace folder change events.");return!this._notificationIsAutoRegistered&&!this._unregistration&&(this._unregistration=this.connection.client.register(Fc.DidChangeWorkspaceFoldersNotification.type)),this._onDidChangeWorkspaceFolders.event}};Uc.WorkspaceFoldersFeature=sk});var cN=Q(Vc=>{"use strict";Object.defineProperty(Vc,"__esModule",{value:!0});Vc.CallHierarchyFeature=void 0;var Ch=vt(),ak=t=>class extends t{get callHierarchy(){return{onPrepare:e=>this.connection.onRequest(Ch.CallHierarchyPrepareRequest.type,(r,n)=>e(r,n,this.attachWorkDoneProgress(r),void 0)),onIncomingCalls:e=>{let r=Ch.CallHierarchyIncomingCallsRequest.type;return this.connection.onRequest(r,(n,i)=>e(n,i,this.attachWorkDoneProgress(n),this.attachPartialResultProgress(r,n)))},onOutgoingCalls:e=>{let r=Ch.CallHierarchyOutgoingCallsRequest.type;return this.connection.onRequest(r,(n,i)=>e(n,i,this.attachWorkDoneProgress(n),this.attachPartialResultProgress(r,n)))}}}};Vc.CallHierarchyFeature=ak});var Lh=Q(Vi=>{"use strict";Object.defineProperty(Vi,"__esModule",{value:!0});Vi.SemanticTokensBuilder=Vi.SemanticTokensDiff=Vi.SemanticTokensFeature=void 0;var Bc=vt(),lk=t=>class extends t{get semanticTokens(){return{refresh:()=>this.connection.sendRequest(Bc.SemanticTokensRefreshRequest.type),on:e=>{let r=Bc.SemanticTokensRequest.type;return this.connection.onRequest(r,(n,i)=>e(n,i,this.attachWorkDoneProgress(n),this.attachPartialResultProgress(r,n)))},onDelta:e=>{let r=Bc.SemanticTokensDeltaRequest.type;return this.connection.onRequest(r,(n,i)=>e(n,i,this.attachWorkDoneProgress(n),this.attachPartialResultProgress(r,n)))},onRange:e=>{let r=Bc.SemanticTokensRangeRequest.type;return this.connection.onRequest(r,(n,i)=>e(n,i,this.attachWorkDoneProgress(n),this.attachPartialResultProgress(r,n)))}}}};Vi.SemanticTokensFeature=lk;var Wc=class{constructor(e,r){this.originalSequence=e,this.modifiedSequence=r}computeDiff(){let e=this.originalSequence.length,r=this.modifiedSequence.length,n=0;for(;n<r&&n<e&&this.originalSequence[n]===this.modifiedSequence[n];)n++;if(n<r&&n<e){let i=e-1,o=r-1;for(;i>=n&&o>=n&&this.originalSequence[i]===this.modifiedSequence[o];)i--,o--;(i<n||o<n)&&(i++,o++);let s=i-n+1,a=this.modifiedSequence.slice(n,o+1);return a.length===1&&a[0]===this.originalSequence[i]?[{start:n,deleteCount:s-1}]:[{start:n,deleteCount:s,data:a}]}else return n<r?[{start:n,deleteCount:0,data:this.modifiedSequence.slice(n)}]:n<e?[{start:n,deleteCount:e-n}]:[]}};Vi.SemanticTokensDiff=Wc;var bh=class{constructor(){this._prevData=void 0,this.initialize()}initialize(){this._id=Date.now(),this._prevLine=0,this._prevChar=0,this._data=[],this._dataLen=0}push(e,r,n,i,o){let s=e,a=r;this._dataLen>0&&(s-=this._prevLine,s===0&&(a-=this._prevChar)),this._data[this._dataLen++]=s,this._data[this._dataLen++]=a,this._data[this._dataLen++]=n,this._data[this._dataLen++]=i,this._data[this._dataLen++]=o,this._prevLine=e,this._prevChar=r}get id(){return this._id.toString()}previousResult(e){this.id===e&&(this._prevData=this._data),this.initialize()}build(){return this._prevData=void 0,{resultId:this.id,data:this._data}}canBuildEdits(){return this._prevData!==void 0}buildEdits(){return this._prevData!==void 0?{resultId:this.id,edits:new Wc(this._prevData,this._data).computeDiff()}:this.build()}};Vi.SemanticTokensBuilder=bh});var fN=Q(Gc=>{"use strict";Object.defineProperty(Gc,"__esModule",{value:!0});Gc.ShowDocumentFeature=void 0;var uk=vt(),ck=t=>class extends t{showDocument(e){return this.connection.sendRequest(uk.ShowDocumentRequest.type,e)}};Gc.ShowDocumentFeature=ck});var dN=Q(jc=>{"use strict";Object.defineProperty(jc,"__esModule",{value:!0});jc.FileOperationsFeature=void 0;var Ps=vt(),fk=t=>class extends t{onDidCreateFiles(e){return this.connection.onNotification(Ps.DidCreateFilesNotification.type,r=>{e(r)})}onDidRenameFiles(e){return this.connection.onNotification(Ps.DidRenameFilesNotification.type,r=>{e(r)})}onDidDeleteFiles(e){return this.connection.onNotification(Ps.DidDeleteFilesNotification.type,r=>{e(r)})}onWillCreateFiles(e){return this.connection.onRequest(Ps.WillCreateFilesRequest.type,(r,n)=>e(r,n))}onWillRenameFiles(e){return this.connection.onRequest(Ps.WillRenameFilesRequest.type,(r,n)=>e(r,n))}onWillDeleteFiles(e){return this.connection.onRequest(Ps.WillDeleteFilesRequest.type,(r,n)=>e(r,n))}};jc.FileOperationsFeature=fk});var pN=Q(qc=>{"use strict";Object.defineProperty(qc,"__esModule",{value:!0});qc.LinkedEditingRangeFeature=void 0;var dk=vt(),pk=t=>class extends t{onLinkedEditingRange(e){return this.connection.onRequest(dk.LinkedEditingRangeRequest.type,(r,n)=>e(r,n,this.attachWorkDoneProgress(r),void 0))}};qc.LinkedEditingRangeFeature=pk});var mN=Q(Hc=>{"use strict";Object.defineProperty(Hc,"__esModule",{value:!0});Hc.TypeHierarchyFeature=void 0;var kh=vt(),mk=t=>class extends t{get typeHierarchy(){return{onPrepare:e=>this.connection.onRequest(kh.TypeHierarchyPrepareRequest.type,(r,n)=>e(r,n,this.attachWorkDoneProgress(r),void 0)),onSupertypes:e=>{let r=kh.TypeHierarchySupertypesRequest.type;return this.connection.onRequest(r,(n,i)=>e(n,i,this.attachWorkDoneProgress(n),this.attachPartialResultProgress(r,n)))},onSubtypes:e=>{let r=kh.TypeHierarchySubtypesRequest.type;return this.connection.onRequest(r,(n,i)=>e(n,i,this.attachWorkDoneProgress(n),this.attachPartialResultProgress(r,n)))}}}};Hc.TypeHierarchyFeature=mk});var gN=Q(Kc=>{"use strict";Object.defineProperty(Kc,"__esModule",{value:!0});Kc.InlineValueFeature=void 0;var hN=vt(),hk=t=>class extends t{get inlineValue(){return{refresh:()=>this.connection.sendRequest(hN.InlineValueRefreshRequest.type),on:e=>this.connection.onRequest(hN.InlineValueRequest.type,(r,n)=>e(r,n,this.attachWorkDoneProgress(r)))}}};Kc.InlineValueFeature=hk});var yN=Q(zc=>{"use strict";Object.defineProperty(zc,"__esModule",{value:!0});zc.FoldingRangeFeature=void 0;var TN=vt(),gk=t=>class extends t{get foldingRange(){return{refresh:()=>this.connection.sendRequest(TN.FoldingRangeRefreshRequest.type),on:e=>{let r=TN.FoldingRangeRequest.type;return this.connection.onRequest(r,(n,i)=>e(n,i,this.attachWorkDoneProgress(n),this.attachPartialResultProgress(r,n)))}}}};zc.FoldingRangeFeature=gk});var _N=Q(Yc=>{"use strict";Object.defineProperty(Yc,"__esModule",{value:!0});Yc.InlayHintFeature=void 0;var wh=vt(),Tk=t=>class extends t{get inlayHint(){return{refresh:()=>this.connection.sendRequest(wh.InlayHintRefreshRequest.type),on:e=>this.connection.onRequest(wh.InlayHintRequest.type,(r,n)=>e(r,n,this.attachWorkDoneProgress(r))),resolve:e=>this.connection.onRequest(wh.InlayHintResolveRequest.type,(r,n)=>e(r,n))}}};Yc.InlayHintFeature=Tk});var vN=Q(Xc=>{"use strict";Object.defineProperty(Xc,"__esModule",{value:!0});Xc.DiagnosticFeature=void 0;var gl=vt(),yk=t=>class extends t{get diagnostics(){return{refresh:()=>this.connection.sendRequest(gl.DiagnosticRefreshRequest.type),on:e=>this.connection.onRequest(gl.DocumentDiagnosticRequest.type,(r,n)=>e(r,n,this.attachWorkDoneProgress(r),this.attachPartialResultProgress(gl.DocumentDiagnosticRequest.partialResult,r))),onWorkspace:e=>this.connection.onRequest(gl.WorkspaceDiagnosticRequest.type,(r,n)=>e(r,n,this.attachWorkDoneProgress(r),this.attachPartialResultProgress(gl.WorkspaceDiagnosticRequest.partialResult,r)))}}};Xc.DiagnosticFeature=yk});var Ph=Q(Jc=>{"use strict";Object.defineProperty(Jc,"__esModule",{value:!0});Jc.TextDocuments=void 0;var No=vt(),$h=class{constructor(e){this._configuration=e,this._syncedDocuments=new Map,this._onDidChangeContent=new No.Emitter,this._onDidOpen=new No.Emitter,this._onDidClose=new No.Emitter,this._onDidSave=new No.Emitter,this._onWillSave=new No.Emitter}get onDidOpen(){return this._onDidOpen.event}get onDidChangeContent(){return this._onDidChangeContent.event}get onWillSave(){return this._onWillSave.event}onWillSaveWaitUntil(e){this._willSaveWaitUntil=e}get onDidSave(){return this._onDidSave.event}get onDidClose(){return this._onDidClose.event}get(e){return this._syncedDocuments.get(e)}all(){return Array.from(this._syncedDocuments.values())}keys(){return Array.from(this._syncedDocuments.keys())}listen(e){e.__textDocumentSync=No.TextDocumentSyncKind.Incremental;let r=[];return r.push(e.onDidOpenTextDocument(n=>{let i=n.textDocument,o=this._configuration.create(i.uri,i.languageId,i.version,i.text);this._syncedDocuments.set(i.uri,o);let s=Object.freeze({document:o});this._onDidOpen.fire(s),this._onDidChangeContent.fire(s)})),r.push(e.onDidChangeTextDocument(n=>{let i=n.textDocument,o=n.contentChanges;if(o.length===0)return;let{version:s}=i;if(s==null)throw new Error(`Received document change event for ${i.uri} without valid version identifier`);let a=this._syncedDocuments.get(i.uri);a!==void 0&&(a=this._configuration.update(a,o,s),this._syncedDocuments.set(i.uri,a),this._onDidChangeContent.fire(Object.freeze({document:a})))})),r.push(e.onDidCloseTextDocument(n=>{let i=this._syncedDocuments.get(n.textDocument.uri);i!==void 0&&(this._syncedDocuments.delete(n.textDocument.uri),this._onDidClose.fire(Object.freeze({document:i})))})),r.push(e.onWillSaveTextDocument(n=>{let i=this._syncedDocuments.get(n.textDocument.uri);i!==void 0&&this._onWillSave.fire(Object.freeze({document:i,reason:n.reason}))})),r.push(e.onWillSaveTextDocumentWaitUntil((n,i)=>{let o=this._syncedDocuments.get(n.textDocument.uri);return o!==void 0&&this._willSaveWaitUntil?this._willSaveWaitUntil(Object.freeze({document:o,reason:n.reason}),i):[]})),r.push(e.onDidSaveTextDocument(n=>{let i=this._syncedDocuments.get(n.textDocument.uri);i!==void 0&&this._onDidSave.fire(Object.freeze({document:i}))})),No.Disposable.create(()=>{r.forEach(n=>n.dispose())})}};Jc.TextDocuments=$h});var Fh=Q(Ms=>{"use strict";Object.defineProperty(Ms,"__esModule",{value:!0});Ms.NotebookDocuments=Ms.NotebookSyncFeature=void 0;var ln=vt(),RN=Ph(),_k=t=>class extends t{get synchronization(){return{onDidOpenNotebookDocument:e=>this.connection.onNotification(ln.DidOpenNotebookDocumentNotification.type,r=>{e(r)}),onDidChangeNotebookDocument:e=>this.connection.onNotification(ln.DidChangeNotebookDocumentNotification.type,r=>{e(r)}),onDidSaveNotebookDocument:e=>this.connection.onNotification(ln.DidSaveNotebookDocumentNotification.type,r=>{e(r)}),onDidCloseNotebookDocument:e=>this.connection.onNotification(ln.DidCloseNotebookDocumentNotification.type,r=>{e(r)})}}};Ms.NotebookSyncFeature=_k;var Qc=class t{onDidOpenTextDocument(e){return this.openHandler=e,ln.Disposable.create(()=>{this.openHandler=void 0})}openTextDocument(e){this.openHandler&&this.openHandler(e)}onDidChangeTextDocument(e){return this.changeHandler=e,ln.Disposable.create(()=>{this.changeHandler=e})}changeTextDocument(e){this.changeHandler&&this.changeHandler(e)}onDidCloseTextDocument(e){return this.closeHandler=e,ln.Disposable.create(()=>{this.closeHandler=void 0})}closeTextDocument(e){this.closeHandler&&this.closeHandler(e)}onWillSaveTextDocument(){return t.NULL_DISPOSE}onWillSaveTextDocumentWaitUntil(){return t.NULL_DISPOSE}onDidSaveTextDocument(){return t.NULL_DISPOSE}};Qc.NULL_DISPOSE=Object.freeze({dispose:()=>{}});var Mh=class{constructor(e){e instanceof RN.TextDocuments?this._cellTextDocuments=e:this._cellTextDocuments=new RN.TextDocuments(e),this.notebookDocuments=new Map,this.notebookCellMap=new Map,this._onDidOpen=new ln.Emitter,this._onDidChange=new ln.Emitter,this._onDidSave=new ln.Emitter,this._onDidClose=new ln.Emitter}get cellTextDocuments(){return this._cellTextDocuments}getCellTextDocument(e){return this._cellTextDocuments.get(e.document)}getNotebookDocument(e){return this.notebookDocuments.get(e)}getNotebookCell(e){let r=this.notebookCellMap.get(e);return r&&r[0]}findNotebookDocumentForCell(e){let r=typeof e=="string"?e:e.document,n=this.notebookCellMap.get(r);return n&&n[1]}get onDidOpen(){return this._onDidOpen.event}get onDidSave(){return this._onDidSave.event}get onDidChange(){return this._onDidChange.event}get onDidClose(){return this._onDidClose.event}listen(e){let r=new Qc,n=[];return n.push(this.cellTextDocuments.listen(r)),n.push(e.notebooks.synchronization.onDidOpenNotebookDocument(i=>{this.notebookDocuments.set(i.notebookDocument.uri,i.notebookDocument);for(let o of i.cellTextDocuments)r.openTextDocument({textDocument:o});this.updateCellMap(i.notebookDocument),this._onDidOpen.fire(i.notebookDocument)})),n.push(e.notebooks.synchronization.onDidChangeNotebookDocument(i=>{let o=this.notebookDocuments.get(i.notebookDocument.uri);if(o===void 0)return;o.version=i.notebookDocument.version;let s=o.metadata,a=!1,l=i.change;l.metadata!==void 0&&(a=!0,o.metadata=l.metadata);let u=[],c=[],f=[],d=[];if(l.cells!==void 0){let I=l.cells;if(I.structure!==void 0){let y=I.structure.array;if(o.cells.splice(y.start,y.deleteCount,...y.cells!==void 0?y.cells:[]),I.structure.didOpen!==void 0)for(let g of I.structure.didOpen)r.openTextDocument({textDocument:g}),u.push(g.uri);if(I.structure.didClose)for(let g of I.structure.didClose)r.closeTextDocument({textDocument:g}),c.push(g.uri)}if(I.data!==void 0){let y=new Map(I.data.map(g=>[g.document,g]));for(let g=0;g<=o.cells.length;g++){let O=y.get(o.cells[g].document);if(O!==void 0){let M=o.cells.splice(g,1,O);if(f.push({old:M[0],new:O}),y.delete(O.document),y.size===0)break}}}if(I.textContent!==void 0)for(let y of I.textContent)r.changeTextDocument({textDocument:y.document,contentChanges:y.changes}),d.push(y.document.uri)}this.updateCellMap(o);let m={notebookDocument:o};a&&(m.metadata={old:s,new:o.metadata});let _=[];for(let I of u)_.push(this.getNotebookCell(I));let x=[];for(let I of c)x.push(this.getNotebookCell(I));let A=[];for(let I of d)A.push(this.getNotebookCell(I));(_.length>0||x.length>0||f.length>0||A.length>0)&&(m.cells={added:_,removed:x,changed:{data:f,textContent:A}}),(m.metadata!==void 0||m.cells!==void 0)&&this._onDidChange.fire(m)})),n.push(e.notebooks.synchronization.onDidSaveNotebookDocument(i=>{let o=this.notebookDocuments.get(i.notebookDocument.uri);o!==void 0&&this._onDidSave.fire(o)})),n.push(e.notebooks.synchronization.onDidCloseNotebookDocument(i=>{let o=this.notebookDocuments.get(i.notebookDocument.uri);if(o!==void 0){this._onDidClose.fire(o);for(let s of i.cellTextDocuments)r.closeTextDocument({textDocument:s});this.notebookDocuments.delete(i.notebookDocument.uri);for(let s of o.cells)this.notebookCellMap.delete(s.document)}})),ln.Disposable.create(()=>{n.forEach(i=>i.dispose())})}updateCellMap(e){for(let r of e.cells)this.notebookCellMap.set(r.document,[r,e])}};Ms.NotebookDocuments=Mh});var xN=Q(Zc=>{"use strict";Object.defineProperty(Zc,"__esModule",{value:!0});Zc.MonikerFeature=void 0;var vk=vt(),Rk=t=>class extends t{get moniker(){return{on:e=>{let r=vk.MonikerRequest.type;return this.connection.onRequest(r,(n,i)=>e(n,i,this.attachWorkDoneProgress(n),this.attachPartialResultProgress(r,n)))}}}};Zc.MonikerFeature=Rk});var jh=Q(Le=>{"use strict";Object.defineProperty(Le,"__esModule",{value:!0});Le.createConnection=Le.combineFeatures=Le.combineNotebooksFeatures=Le.combineLanguagesFeatures=Le.combineWorkspaceFeatures=Le.combineWindowFeatures=Le.combineClientFeatures=Le.combineTracerFeatures=Le.combineTelemetryFeatures=Le.combineConsoleFeatures=Le._NotebooksImpl=Le._LanguagesImpl=Le.BulkUnregistration=Le.BulkRegistration=Le.ErrorMessageTracker=void 0;var X=vt(),un=zu(),Vh=Ah(),ge=aN(),xk=lN(),Nk=uN(),Ek=cN(),Ik=Lh(),Ok=fN(),Ak=dN(),Sk=pN(),Dk=mN(),Ck=gN(),bk=yN(),Lk=_N(),kk=vN(),wk=Fh(),$k=xN();function Uh(t){if(t!==null)return t}var Bh=class{constructor(){this._messages=Object.create(null)}add(e){let r=this._messages[e];r||(r=0),r++,this._messages[e]=r}sendErrors(e){Object.keys(this._messages).forEach(r=>{e.window.showErrorMessage(r)})}};Le.ErrorMessageTracker=Bh;var ef=class{constructor(){}rawAttach(e){this._rawConnection=e}attach(e){this._connection=e}get connection(){if(!this._connection)throw new Error("Remote is not attached to a connection yet.");return this._connection}fillServerCapabilities(e){}initialize(e){}error(e){this.send(X.MessageType.Error,e)}warn(e){this.send(X.MessageType.Warning,e)}info(e){this.send(X.MessageType.Info,e)}log(e){this.send(X.MessageType.Log,e)}debug(e){this.send(X.MessageType.Debug,e)}send(e,r){this._rawConnection&&this._rawConnection.sendNotification(X.LogMessageNotification.type,{type:e,message:r}).catch(()=>{(0,X.RAL)().console.error("Sending log message failed")})}},Wh=class{constructor(){}attach(e){this._connection=e}get connection(){if(!this._connection)throw new Error("Remote is not attached to a connection yet.");return this._connection}initialize(e){}fillServerCapabilities(e){}showErrorMessage(e,...r){let n={type:X.MessageType.Error,message:e,actions:r};return this.connection.sendRequest(X.ShowMessageRequest.type,n).then(Uh)}showWarningMessage(e,...r){let n={type:X.MessageType.Warning,message:e,actions:r};return this.connection.sendRequest(X.ShowMessageRequest.type,n).then(Uh)}showInformationMessage(e,...r){let n={type:X.MessageType.Info,message:e,actions:r};return this.connection.sendRequest(X.ShowMessageRequest.type,n).then(Uh)}},NN=(0,Ok.ShowDocumentFeature)((0,ge.ProgressFeature)(Wh)),EN;(function(t){function e(){return new tf}t.create=e})(EN||(Le.BulkRegistration=EN={}));var tf=class{constructor(){this._registrations=[],this._registered=new Set}add(e,r){let n=un.string(e)?e:e.method;if(this._registered.has(n))throw new Error(`${n} is already added to this registration`);let i=Vh.generateUuid();this._registrations.push({id:i,method:n,registerOptions:r||{}}),this._registered.add(n)}asRegistrationParams(){return{registrations:this._registrations}}},IN;(function(t){function e(){return new Tl(void 0,[])}t.create=e})(IN||(Le.BulkUnregistration=IN={}));var Tl=class{constructor(e,r){this._connection=e,this._unregistrations=new Map,r.forEach(n=>{this._unregistrations.set(n.method,n)})}get isAttached(){return!!this._connection}attach(e){this._connection=e}add(e){this._unregistrations.set(e.method,e)}dispose(){let e=[];for(let n of this._unregistrations.values())e.push(n);let r={unregisterations:e};this._connection.sendRequest(X.UnregistrationRequest.type,r).catch(()=>{this._connection.console.info("Bulk unregistration failed.")})}disposeSingle(e){let r=un.string(e)?e:e.method,n=this._unregistrations.get(r);if(!n)return!1;let i={unregisterations:[n]};return this._connection.sendRequest(X.UnregistrationRequest.type,i).then(()=>{this._unregistrations.delete(r)},o=>{this._connection.console.info(`Un-registering request handler for ${n.id} failed.`)}),!0}},rf=class{attach(e){this._connection=e}get connection(){if(!this._connection)throw new Error("Remote is not attached to a connection yet.");return this._connection}initialize(e){}fillServerCapabilities(e){}register(e,r,n){return e instanceof tf?this.registerMany(e):e instanceof Tl?this.registerSingle1(e,r,n):this.registerSingle2(e,r)}registerSingle1(e,r,n){let i=un.string(r)?r:r.method,o=Vh.generateUuid(),s={registrations:[{id:o,method:i,registerOptions:n||{}}]};return e.isAttached||e.attach(this.connection),this.connection.sendRequest(X.RegistrationRequest.type,s).then(a=>(e.add({id:o,method:i}),e),a=>(this.connection.console.info(`Registering request handler for ${i} failed.`),Promise.reject(a)))}registerSingle2(e,r){let n=un.string(e)?e:e.method,i=Vh.generateUuid(),o={registrations:[{id:i,method:n,registerOptions:r||{}}]};return this.connection.sendRequest(X.RegistrationRequest.type,o).then(s=>X.Disposable.create(()=>{this.unregisterSingle(i,n).catch(()=>{this.connection.console.info(`Un-registering capability with id ${i} failed.`)})}),s=>(this.connection.console.info(`Registering request handler for ${n} failed.`),Promise.reject(s)))}unregisterSingle(e,r){let n={unregisterations:[{id:e,method:r}]};return this.connection.sendRequest(X.UnregistrationRequest.type,n).catch(()=>{this.connection.console.info(`Un-registering request handler for ${e} failed.`)})}registerMany(e){let r=e.asRegistrationParams();return this.connection.sendRequest(X.RegistrationRequest.type,r).then(()=>new Tl(this._connection,r.registrations.map(n=>({id:n.id,method:n.method}))),n=>(this.connection.console.info("Bulk registration failed."),Promise.reject(n)))}},Gh=class{constructor(){}attach(e){this._connection=e}get connection(){if(!this._connection)throw new Error("Remote is not attached to a connection yet.");return this._connection}initialize(e){}fillServerCapabilities(e){}applyEdit(e){function r(i){return i&&!!i.edit}let n=r(e)?e:{edit:e};return this.connection.sendRequest(X.ApplyWorkspaceEditRequest.type,n)}},ON=(0,Ak.FileOperationsFeature)((0,Nk.WorkspaceFoldersFeature)((0,xk.ConfigurationFeature)(Gh))),nf=class{constructor(){this._trace=X.Trace.Off}attach(e){this._connection=e}get connection(){if(!this._connection)throw new Error("Remote is not attached to a connection yet.");return this._connection}initialize(e){}fillServerCapabilities(e){}set trace(e){this._trace=e}log(e,r){this._trace!==X.Trace.Off&&this.connection.sendNotification(X.LogTraceNotification.type,{message:e,verbose:this._trace===X.Trace.Verbose?r:void 0}).catch(()=>{})}},of=class{constructor(){}attach(e){this._connection=e}get connection(){if(!this._connection)throw new Error("Remote is not attached to a connection yet.");return this._connection}initialize(e){}fillServerCapabilities(e){}logEvent(e){this.connection.sendNotification(X.TelemetryEventNotification.type,e).catch(()=>{this.connection.console.log("Sending TelemetryEventNotification failed")})}},sf=class{constructor(){}attach(e){this._connection=e}get connection(){if(!this._connection)throw new Error("Remote is not attached to a connection yet.");return this._connection}initialize(e){}fillServerCapabilities(e){}attachWorkDoneProgress(e){return(0,ge.attachWorkDone)(this.connection,e)}attachPartialResultProgress(e,r){return(0,ge.attachPartialResult)(this.connection,r)}};Le._LanguagesImpl=sf;var AN=(0,bk.FoldingRangeFeature)((0,$k.MonikerFeature)((0,kk.DiagnosticFeature)((0,Lk.InlayHintFeature)((0,Ck.InlineValueFeature)((0,Dk.TypeHierarchyFeature)((0,Sk.LinkedEditingRangeFeature)((0,Ik.SemanticTokensFeature)((0,Ek.CallHierarchyFeature)(sf))))))))),af=class{constructor(){}attach(e){this._connection=e}get connection(){if(!this._connection)throw new Error("Remote is not attached to a connection yet.");return this._connection}initialize(e){}fillServerCapabilities(e){}attachWorkDoneProgress(e){return(0,ge.attachWorkDone)(this.connection,e)}attachPartialResultProgress(e,r){return(0,ge.attachPartialResult)(this.connection,r)}};Le._NotebooksImpl=af;var SN=(0,wk.NotebookSyncFeature)(af);function DN(t,e){return function(r){return e(t(r))}}Le.combineConsoleFeatures=DN;function CN(t,e){return function(r){return e(t(r))}}Le.combineTelemetryFeatures=CN;function bN(t,e){return function(r){return e(t(r))}}Le.combineTracerFeatures=bN;function LN(t,e){return function(r){return e(t(r))}}Le.combineClientFeatures=LN;function kN(t,e){return function(r){return e(t(r))}}Le.combineWindowFeatures=kN;function wN(t,e){return function(r){return e(t(r))}}Le.combineWorkspaceFeatures=wN;function $N(t,e){return function(r){return e(t(r))}}Le.combineLanguagesFeatures=$N;function PN(t,e){return function(r){return e(t(r))}}Le.combineNotebooksFeatures=PN;function Pk(t,e){function r(i,o,s){return i&&o?s(i,o):i||o}return{__brand:"features",console:r(t.console,e.console,DN),tracer:r(t.tracer,e.tracer,bN),telemetry:r(t.telemetry,e.telemetry,CN),client:r(t.client,e.client,LN),window:r(t.window,e.window,kN),workspace:r(t.workspace,e.workspace,wN),languages:r(t.languages,e.languages,$N),notebooks:r(t.notebooks,e.notebooks,PN)}}Le.combineFeatures=Pk;function Mk(t,e,r){let n=r&&r.console?new(r.console(ef)):new ef,i=t(n);n.rawAttach(i);let o=r&&r.tracer?new(r.tracer(nf)):new nf,s=r&&r.telemetry?new(r.telemetry(of)):new of,a=r&&r.client?new(r.client(rf)):new rf,l=r&&r.window?new(r.window(NN)):new NN,u=r&&r.workspace?new(r.workspace(ON)):new ON,c=r&&r.languages?new(r.languages(AN)):new AN,f=r&&r.notebooks?new(r.notebooks(SN)):new SN,d=[n,o,s,a,l,u,c,f];function m(y){return y instanceof Promise?y:un.thenable(y)?new Promise((g,O)=>{y.then(M=>g(M),M=>O(M))}):Promise.resolve(y)}let _,x,A,I={listen:()=>i.listen(),sendRequest:(y,...g)=>i.sendRequest(un.string(y)?y:y.method,...g),onRequest:(y,g)=>i.onRequest(y,g),sendNotification:(y,g)=>{let O=un.string(y)?y:y.method;return i.sendNotification(O,g)},onNotification:(y,g)=>i.onNotification(y,g),onProgress:i.onProgress,sendProgress:i.sendProgress,onInitialize:y=>(x=y,{dispose:()=>{x=void 0}}),onInitialized:y=>i.onNotification(X.InitializedNotification.type,y),onShutdown:y=>(_=y,{dispose:()=>{_=void 0}}),onExit:y=>(A=y,{dispose:()=>{A=void 0}}),get console(){return n},get telemetry(){return s},get tracer(){return o},get client(){return a},get window(){return l},get workspace(){return u},get languages(){return c},get notebooks(){return f},onDidChangeConfiguration:y=>i.onNotification(X.DidChangeConfigurationNotification.type,y),onDidChangeWatchedFiles:y=>i.onNotification(X.DidChangeWatchedFilesNotification.type,y),__textDocumentSync:void 0,onDidOpenTextDocument:y=>i.onNotification(X.DidOpenTextDocumentNotification.type,y),onDidChangeTextDocument:y=>i.onNotification(X.DidChangeTextDocumentNotification.type,y),onDidCloseTextDocument:y=>i.onNotification(X.DidCloseTextDocumentNotification.type,y),onWillSaveTextDocument:y=>i.onNotification(X.WillSaveTextDocumentNotification.type,y),onWillSaveTextDocumentWaitUntil:y=>i.onRequest(X.WillSaveTextDocumentWaitUntilRequest.type,y),onDidSaveTextDocument:y=>i.onNotification(X.DidSaveTextDocumentNotification.type,y),sendDiagnostics:y=>i.sendNotification(X.PublishDiagnosticsNotification.type,y),onHover:y=>i.onRequest(X.HoverRequest.type,(g,O)=>y(g,O,(0,ge.attachWorkDone)(i,g),void 0)),onCompletion:y=>i.onRequest(X.CompletionRequest.type,(g,O)=>y(g,O,(0,ge.attachWorkDone)(i,g),(0,ge.attachPartialResult)(i,g))),onCompletionResolve:y=>i.onRequest(X.CompletionResolveRequest.type,y),onSignatureHelp:y=>i.onRequest(X.SignatureHelpRequest.type,(g,O)=>y(g,O,(0,ge.attachWorkDone)(i,g),void 0)),onDeclaration:y=>i.onRequest(X.DeclarationRequest.type,(g,O)=>y(g,O,(0,ge.attachWorkDone)(i,g),(0,ge.attachPartialResult)(i,g))),onDefinition:y=>i.onRequest(X.DefinitionRequest.type,(g,O)=>y(g,O,(0,ge.attachWorkDone)(i,g),(0,ge.attachPartialResult)(i,g))),onTypeDefinition:y=>i.onRequest(X.TypeDefinitionRequest.type,(g,O)=>y(g,O,(0,ge.attachWorkDone)(i,g),(0,ge.attachPartialResult)(i,g))),onImplementation:y=>i.onRequest(X.ImplementationRequest.type,(g,O)=>y(g,O,(0,ge.attachWorkDone)(i,g),(0,ge.attachPartialResult)(i,g))),onReferences:y=>i.onRequest(X.ReferencesRequest.type,(g,O)=>y(g,O,(0,ge.attachWorkDone)(i,g),(0,ge.attachPartialResult)(i,g))),onDocumentHighlight:y=>i.onRequest(X.DocumentHighlightRequest.type,(g,O)=>y(g,O,(0,ge.attachWorkDone)(i,g),(0,ge.attachPartialResult)(i,g))),onDocumentSymbol:y=>i.onRequest(X.DocumentSymbolRequest.type,(g,O)=>y(g,O,(0,ge.attachWorkDone)(i,g),(0,ge.attachPartialResult)(i,g))),onWorkspaceSymbol:y=>i.onRequest(X.WorkspaceSymbolRequest.type,(g,O)=>y(g,O,(0,ge.attachWorkDone)(i,g),(0,ge.attachPartialResult)(i,g))),onWorkspaceSymbolResolve:y=>i.onRequest(X.WorkspaceSymbolResolveRequest.type,y),onCodeAction:y=>i.onRequest(X.CodeActionRequest.type,(g,O)=>y(g,O,(0,ge.attachWorkDone)(i,g),(0,ge.attachPartialResult)(i,g))),onCodeActionResolve:y=>i.onRequest(X.CodeActionResolveRequest.type,(g,O)=>y(g,O)),onCodeLens:y=>i.onRequest(X.CodeLensRequest.type,(g,O)=>y(g,O,(0,ge.attachWorkDone)(i,g),(0,ge.attachPartialResult)(i,g))),onCodeLensResolve:y=>i.onRequest(X.CodeLensResolveRequest.type,(g,O)=>y(g,O)),onDocumentFormatting:y=>i.onRequest(X.DocumentFormattingRequest.type,(g,O)=>y(g,O,(0,ge.attachWorkDone)(i,g),void 0)),onDocumentRangeFormatting:y=>i.onRequest(X.DocumentRangeFormattingRequest.type,(g,O)=>y(g,O,(0,ge.attachWorkDone)(i,g),void 0)),onDocumentOnTypeFormatting:y=>i.onRequest(X.DocumentOnTypeFormattingRequest.type,(g,O)=>y(g,O)),onRenameRequest:y=>i.onRequest(X.RenameRequest.type,(g,O)=>y(g,O,(0,ge.attachWorkDone)(i,g),void 0)),onPrepareRename:y=>i.onRequest(X.PrepareRenameRequest.type,(g,O)=>y(g,O)),onDocumentLinks:y=>i.onRequest(X.DocumentLinkRequest.type,(g,O)=>y(g,O,(0,ge.attachWorkDone)(i,g),(0,ge.attachPartialResult)(i,g))),onDocumentLinkResolve:y=>i.onRequest(X.DocumentLinkResolveRequest.type,(g,O)=>y(g,O)),onDocumentColor:y=>i.onRequest(X.DocumentColorRequest.type,(g,O)=>y(g,O,(0,ge.attachWorkDone)(i,g),(0,ge.attachPartialResult)(i,g))),onColorPresentation:y=>i.onRequest(X.ColorPresentationRequest.type,(g,O)=>y(g,O,(0,ge.attachWorkDone)(i,g),(0,ge.attachPartialResult)(i,g))),onFoldingRanges:y=>i.onRequest(X.FoldingRangeRequest.type,(g,O)=>y(g,O,(0,ge.attachWorkDone)(i,g),(0,ge.attachPartialResult)(i,g))),onSelectionRanges:y=>i.onRequest(X.SelectionRangeRequest.type,(g,O)=>y(g,O,(0,ge.attachWorkDone)(i,g),(0,ge.attachPartialResult)(i,g))),onExecuteCommand:y=>i.onRequest(X.ExecuteCommandRequest.type,(g,O)=>y(g,O,(0,ge.attachWorkDone)(i,g),void 0)),dispose:()=>i.dispose()};for(let y of d)y.attach(I);return i.onRequest(X.InitializeRequest.type,y=>{e.initialize(y),un.string(y.trace)&&(o.trace=X.Trace.fromString(y.trace));for(let g of d)g.initialize(y.capabilities);if(x){let g=x(y,new X.CancellationTokenSource().token,(0,ge.attachWorkDone)(i,y),void 0);return m(g).then(O=>{if(O instanceof X.ResponseError)return O;let M=O;M||(M={capabilities:{}});let J=M.capabilities;J||(J={},M.capabilities=J),J.textDocumentSync===void 0||J.textDocumentSync===null?J.textDocumentSync=un.number(I.__textDocumentSync)?I.__textDocumentSync:X.TextDocumentSyncKind.None:!un.number(J.textDocumentSync)&&!un.number(J.textDocumentSync.change)&&(J.textDocumentSync.change=un.number(I.__textDocumentSync)?I.__textDocumentSync:X.TextDocumentSyncKind.None);for(let ce of d)ce.fillServerCapabilities(J);return M})}else{let g={capabilities:{textDocumentSync:X.TextDocumentSyncKind.None}};for(let O of d)O.fillServerCapabilities(g.capabilities);return g}}),i.onRequest(X.ShutdownRequest.type,()=>{if(e.shutdownReceived=!0,_)return _(new X.CancellationTokenSource().token)}),i.onNotification(X.ExitNotification.type,()=>{try{A&&A()}finally{e.shutdownReceived?e.exit(0):e.exit(1)}}),i.onNotification(X.SetTraceNotification.type,y=>{o.trace=X.Trace.fromString(y.value)}),I}Le.createConnection=Mk});var MN=Q(Br=>{"use strict";Object.defineProperty(Br,"__esModule",{value:!0});Br.resolveModulePath=Br.FileSystem=Br.resolveGlobalYarnPath=Br.resolveGlobalNodePath=Br.resolve=Br.uriToFilePath=void 0;var Fk=require("url"),xn=require("path"),qh=require("fs"),Yh=require("child_process");function Uk(t){let e=Fk.parse(t);if(e.protocol!=="file:"||!e.path)return;let r=e.path.split("/");for(var n=0,i=r.length;n<i;n++)r[n]=decodeURIComponent(r[n]);if(process.platform==="win32"&&r.length>1){let o=r[0],s=r[1];o.length===0&&s.length>1&&s[1]===":"&&r.shift()}return xn.normalize(r.join("/"))}Br.uriToFilePath=Uk;function Hh(){return process.platform==="win32"}function lf(t,e,r,n){let i="NODE_PATH",o=["var p = process;","p.on('message',function(m){","if(m.c==='e'){","p.exit(0);","}","else if(m.c==='rs'){","try{","var r=require.resolve(m.a);","p.send({c:'r',s:true,r:r});","}","catch(err){","p.send({c:'r',s:false});","}","}","});"].join("");return new Promise((s,a)=>{let l=process.env,u=Object.create(null);Object.keys(l).forEach(c=>u[c]=l[c]),e&&qh.existsSync(e)&&(u[i]?u[i]=e+xn.delimiter+u[i]:u[i]=e,n&&n(`NODE_PATH value is: ${u[i]}`)),u.ELECTRON_RUN_AS_NODE="1";try{let c=(0,Yh.fork)("",[],{cwd:r,env:u,execArgv:["-e",o]});if(c.pid===void 0){a(new Error(`Starting process to resolve node module  ${t} failed`));return}c.on("error",d=>{a(d)}),c.on("message",d=>{d.c==="r"&&(c.send({c:"e"}),d.s?s(d.r):a(new Error(`Failed to resolve module: ${t}`)))});let f={c:"rs",a:t};c.send(f)}catch(c){a(c)}})}Br.resolve=lf;function Kh(t){let e="npm",r=Object.create(null);Object.keys(process.env).forEach(o=>r[o]=process.env[o]),r.NO_UPDATE_NOTIFIER="true";let n={encoding:"utf8",env:r};Hh()&&(e="npm.cmd",n.shell=!0);let i=()=>{};try{process.on("SIGPIPE",i);let o=(0,Yh.spawnSync)(e,["config","get","prefix"],n).stdout;if(!o){t&&t("'npm config get prefix' didn't return a value.");return}let s=o.trim();return t&&t(`'npm config get prefix' value is: ${s}`),s.length>0?Hh()?xn.join(s,"node_modules"):xn.join(s,"lib","node_modules"):void 0}catch{return}finally{process.removeListener("SIGPIPE",i)}}Br.resolveGlobalNodePath=Kh;function Vk(t){let e="yarn",r={encoding:"utf8"};Hh()&&(e="yarn.cmd",r.shell=!0);let n=()=>{};try{process.on("SIGPIPE",n);let i=(0,Yh.spawnSync)(e,["global","dir","--json"],r),o=i.stdout;if(!o){t&&(t("'yarn global dir' didn't return a value."),i.stderr&&t(i.stderr));return}let s=o.trim().split(/\r?\n/);for(let a of s)try{let l=JSON.parse(a);if(l.type==="log")return xn.join(l.data,"node_modules")}catch{}return}catch{return}finally{process.removeListener("SIGPIPE",n)}}Br.resolveGlobalYarnPath=Vk;var zh;(function(t){let e;function r(){return e!==void 0||(process.platform==="win32"?e=!1:e=!qh.existsSync(__filename.toUpperCase())||!qh.existsSync(__filename.toLowerCase())),e}t.isCaseSensitive=r;function n(i,o){return r()?xn.normalize(o).indexOf(xn.normalize(i))===0:xn.normalize(o).toLowerCase().indexOf(xn.normalize(i).toLowerCase())===0}t.isParent=n})(zh||(Br.FileSystem=zh={}));function Bk(t,e,r,n){return r?(xn.isAbsolute(r)||(r=xn.join(t,r)),lf(e,r,r,n).then(i=>zh.isParent(r,i)?i:Promise.reject(new Error(`Failed to load ${e} from node path location.`))).then(void 0,i=>lf(e,Kh(n),t,n))):lf(e,Kh(n),t,n)}Br.resolveModulePath=Bk});var Xh=Q((kq,FN)=>{"use strict";FN.exports=vt()});var UN=Q(uf=>{"use strict";Object.defineProperty(uf,"__esModule",{value:!0});uf.InlineCompletionFeature=void 0;var Wk=vt(),Gk=t=>class extends t{get inlineCompletion(){return{on:e=>this.connection.onRequest(Wk.InlineCompletionRequest.type,(r,n)=>e(r,n,this.attachWorkDoneProgress(r)))}}};uf.InlineCompletionFeature=Gk});var WN=Q(_r=>{"use strict";var jk=_r&&_r.__createBinding||(Object.create?function(t,e,r,n){n===void 0&&(n=r);var i=Object.getOwnPropertyDescriptor(e,r);(!i||("get"in i?!e.__esModule:i.writable||i.configurable))&&(i={enumerable:!0,get:function(){return e[r]}}),Object.defineProperty(t,n,i)}:function(t,e,r,n){n===void 0&&(n=r),t[n]=e[r]}),BN=_r&&_r.__exportStar||function(t,e){for(var r in t)r!=="default"&&!Object.prototype.hasOwnProperty.call(e,r)&&jk(e,t,r)};Object.defineProperty(_r,"__esModule",{value:!0});_r.ProposedFeatures=_r.NotebookDocuments=_r.TextDocuments=_r.SemanticTokensBuilder=void 0;var qk=Lh();Object.defineProperty(_r,"SemanticTokensBuilder",{enumerable:!0,get:function(){return qk.SemanticTokensBuilder}});var Hk=UN();BN(vt(),_r);var Kk=Ph();Object.defineProperty(_r,"TextDocuments",{enumerable:!0,get:function(){return Kk.TextDocuments}});var zk=Fh();Object.defineProperty(_r,"NotebookDocuments",{enumerable:!0,get:function(){return zk.NotebookDocuments}});BN(jh(),_r);var VN;(function(t){t.all={__brand:"features",languages:Hk.InlineCompletionFeature}})(VN||(_r.ProposedFeatures=VN={}))});var Or=Q(cn=>{"use strict";var Yk=cn&&cn.__createBinding||(Object.create?function(t,e,r,n){n===void 0&&(n=r);var i=Object.getOwnPropertyDescriptor(e,r);(!i||("get"in i?!e.__esModule:i.writable||i.configurable))&&(i={enumerable:!0,get:function(){return e[r]}}),Object.defineProperty(t,n,i)}:function(t,e,r,n){n===void 0&&(n=r),t[n]=e[r]}),HN=cn&&cn.__exportStar||function(t,e){for(var r in t)r!=="default"&&!Object.prototype.hasOwnProperty.call(e,r)&&Yk(e,t,r)};Object.defineProperty(cn,"__esModule",{value:!0});cn.createConnection=cn.Files=void 0;var GN=require("util"),Jh=zu(),Xk=jh(),yl=MN(),Eo=Xh();HN(Xh(),cn);HN(WN(),cn);var jN;(function(t){t.uriToFilePath=yl.uriToFilePath,t.resolveGlobalNodePath=yl.resolveGlobalNodePath,t.resolveGlobalYarnPath=yl.resolveGlobalYarnPath,t.resolve=yl.resolve,t.resolveModulePath=yl.resolveModulePath})(jN||(cn.Files=jN={}));var qN;function cf(){if(qN!==void 0)try{qN.end()}catch{}}var Fs=!1,KN;function Jk(){let t="--clientProcessId";function e(r){try{let n=parseInt(r);isNaN(n)||(KN=setInterval(()=>{try{process.kill(n,0)}catch{cf(),process.exit(Fs?0:1)}},3e3))}catch{}}for(let r=2;r<process.argv.length;r++){let n=process.argv[r];if(n===t&&r+1<process.argv.length){e(process.argv[r+1]);return}else{let i=n.split("=");i[0]===t&&e(i[1])}}}Jk();var Qk={initialize:t=>{let e=t.processId;Jh.number(e)&&KN===void 0&&setInterval(()=>{try{process.kill(e,0)}catch{process.exit(Fs?0:1)}},3e3)},get shutdownReceived(){return Fs},set shutdownReceived(t){Fs=t},exit:t=>{cf(),process.exit(t)}};function Zk(t,e,r,n){let i,o,s,a;return t!==void 0&&t.__brand==="features"&&(i=t,t=e,e=r,r=n),Eo.ConnectionStrategy.is(t)||Eo.ConnectionOptions.is(t)?a=t:(o=t,s=e,a=r),ew(o,s,a,i)}cn.createConnection=Zk;function ew(t,e,r,n){let i=!1;if(!t&&!e&&process.argv.length>2){let l,u,c=process.argv.slice(2);for(let f=0;f<c.length;f++){let d=c[f];if(d==="--node-ipc"){t=new Eo.IPCMessageReader(process),e=new Eo.IPCMessageWriter(process);break}else if(d==="--stdio"){i=!0,t=process.stdin,e=process.stdout;break}else if(d==="--socket"){l=parseInt(c[f+1]);break}else if(d==="--pipe"){u=c[f+1];break}else{var o=d.split("=");if(o[0]==="--socket"){l=parseInt(o[1]);break}else if(o[0]==="--pipe"){u=o[1];break}}}if(l){let f=(0,Eo.createServerSocketTransport)(l);t=f[0],e=f[1]}else if(u){let f=(0,Eo.createServerPipeTransport)(u);t=f[0],e=f[1]}}var s="Use arguments of createConnection or set command line parameters: '--node-ipc', '--stdio' or '--socket={number}'";if(!t)throw new Error("Connection input stream is not set. "+s);if(!e)throw new Error("Connection output stream is not set. "+s);if(Jh.func(t.read)&&Jh.func(t.on)){let l=t;l.on("end",()=>{cf(),process.exit(Fs?0:1)}),l.on("close",()=>{cf(),process.exit(Fs?0:1)})}let a=l=>{let u=(0,Eo.createProtocolConnection)(t,e,l,r);return i&&tw(l),u};return(0,Xk.createConnection)(a,Qk,n)}function tw(t){function e(n){return n.map(i=>typeof i=="string"?i:(0,GN.inspect)(i)).join(" ")}let r=new Map;console.assert=function(i,...o){if(!i)if(o.length===0)t.error("Assertion failed");else{let[s,...a]=o;t.error(`Assertion failed: ${s} ${e(a)}`)}},console.count=function(i="default"){var a;let o=String(i),s=(a=r.get(o))!=null?a:0;s+=1,r.set(o,s),t.log(`${o}: ${o}`)},console.countReset=function(i){i===void 0?r.clear():r.delete(String(i))},console.debug=function(...i){t.log(e(i))},console.dir=function(i,o){t.log((0,GN.inspect)(i,o))},console.log=function(...i){t.log(e(i))},console.error=function(...i){t.error(e(i))},console.trace=function(...i){let o=new Error().stack.replace(/(.+\n){2}/,""),s="Trace";i.length!==0&&(s+=`: ${e(i)}`),t.log(`${s}
${o}`)},console.warn=function(...i){t.warn(e(i))}}});var wy=Q(ky=>{"use strict";Object.defineProperty(ky,"__esModule",{value:!0});var by;function Ly(){if(by===void 0)throw new Error("No runtime abstraction layer installed");return by}(function(t){function e(r){if(r===void 0)throw new Error("No runtime abstraction layer provided");by=r}t.install=e})(Ly||(Ly={}));ky.default=Ly});var GD=Q(Nr=>{"use strict";Object.defineProperty(Nr,"__esModule",{value:!0});Nr.stringArray=Nr.array=Nr.func=Nr.error=Nr.number=Nr.string=Nr.boolean=void 0;function mW(t){return t===!0||t===!1}Nr.boolean=mW;function BD(t){return typeof t=="string"||t instanceof String}Nr.string=BD;function hW(t){return typeof t=="number"||t instanceof Number}Nr.number=hW;function gW(t){return t instanceof Error}Nr.error=gW;function TW(t){return typeof t=="function"}Nr.func=TW;function WD(t){return Array.isArray(t)}Nr.array=WD;function yW(t){return WD(t)&&t.every(e=>BD(e))}Nr.stringArray=yW});var Py=Q(Ga=>{"use strict";Object.defineProperty(Ga,"__esModule",{value:!0});Ga.Emitter=Ga.Event=void 0;var _W=wy(),jD;(function(t){let e={dispose(){}};t.None=function(){return e}})(jD||(Ga.Event=jD={}));var $y=class{add(e,r=null,n){this._callbacks||(this._callbacks=[],this._contexts=[]),this._callbacks.push(e),this._contexts.push(r),Array.isArray(n)&&n.push({dispose:()=>this.remove(e,r)})}remove(e,r=null){if(!this._callbacks)return;let n=!1;for(let i=0,o=this._callbacks.length;i<o;i++)if(this._callbacks[i]===e)if(this._contexts[i]===r){this._callbacks.splice(i,1),this._contexts.splice(i,1);return}else n=!0;if(n)throw new Error("When adding a listener with a context, you should remove it with the same context")}invoke(...e){if(!this._callbacks)return[];let r=[],n=this._callbacks.slice(0),i=this._contexts.slice(0);for(let o=0,s=n.length;o<s;o++)try{r.push(n[o].apply(i[o],e))}catch(a){(0,_W.default)().console.error(a)}return r}isEmpty(){return!this._callbacks||this._callbacks.length===0}dispose(){this._callbacks=void 0,this._contexts=void 0}},Qd=class t{constructor(e){this._options=e}get event(){return this._event||(this._event=(e,r,n)=>{this._callbacks||(this._callbacks=new $y),this._options&&this._options.onFirstListenerAdd&&this._callbacks.isEmpty()&&this._options.onFirstListenerAdd(this),this._callbacks.add(e,r);let i={dispose:()=>{this._callbacks&&(this._callbacks.remove(e,r),i.dispose=t._noop,this._options&&this._options.onLastListenerRemove&&this._callbacks.isEmpty()&&this._options.onLastListenerRemove(this))}};return Array.isArray(n)&&n.push(i),i}),this._event}fire(e){this._callbacks&&this._callbacks.invoke.call(this._callbacks,e)}dispose(){this._callbacks&&(this._callbacks.dispose(),this._callbacks=void 0)}};Ga.Emitter=Qd;Qd._noop=function(){}});var qD=Q(ja=>{"use strict";Object.defineProperty(ja,"__esModule",{value:!0});ja.CancellationTokenSource=ja.CancellationToken=void 0;var vW=wy(),RW=GD(),My=Py(),Zd;(function(t){t.None=Object.freeze({isCancellationRequested:!1,onCancellationRequested:My.Event.None}),t.Cancelled=Object.freeze({isCancellationRequested:!0,onCancellationRequested:My.Event.None});function e(r){let n=r;return n&&(n===t.None||n===t.Cancelled||RW.boolean(n.isCancellationRequested)&&!!n.onCancellationRequested)}t.is=e})(Zd||(ja.CancellationToken=Zd={}));var xW=Object.freeze(function(t,e){let r=(0,vW.default)().timer.setTimeout(t.bind(e),0);return{dispose(){r.dispose()}}}),ep=class{constructor(){this._isCancelled=!1}cancel(){this._isCancelled||(this._isCancelled=!0,this._emitter&&(this._emitter.fire(void 0),this.dispose()))}get isCancellationRequested(){return this._isCancelled}get onCancellationRequested(){return this._isCancelled?xW:(this._emitter||(this._emitter=new My.Emitter),this._emitter.event)}dispose(){this._emitter&&(this._emitter.dispose(),this._emitter=void 0)}},Fy=class{get token(){return this._token||(this._token=new ep),this._token}cancel(){this._token?this._token.cancel():this._token=Zd.Cancelled}dispose(){this._token?this._token instanceof ep&&this._token.dispose():this._token=Zd.None}};ja.CancellationTokenSource=Fy});var IC=Q((Oae,EC)=>{"use strict";EC.exports=Or()});var sj={};Ai(sj,{shared:()=>Wu,st:()=>Lp});module.exports=Vb(sj);var O_;(function(t){(function(e){var r=typeof global=="object"?global:typeof self=="object"?self:typeof this=="object"?this:Function("return this;")(),n=i(t);typeof r.Reflect=="undefined"?r.Reflect=t:n=i(r.Reflect,n),e(n);function i(o,s){return function(a,l){typeof o[a]!="function"&&Object.defineProperty(o,a,{configurable:!0,writable:!0,value:l}),s&&s(a,l)}}})(function(e){var r=Object.prototype.hasOwnProperty,n=typeof Symbol=="function",i=n&&typeof Symbol.toPrimitive!="undefined"?Symbol.toPrimitive:"@@toPrimitive",o=n&&typeof Symbol.iterator!="undefined"?Symbol.iterator:"@@iterator",s=typeof Object.create=="function",a={__proto__:[]}instanceof Array,l=!s&&!a,u={create:s?function(){return Pr(Object.create(null))}:a?function(){return Pr({__proto__:null})}:function(){return Pr({})},has:l?function(D,F){return r.call(D,F)}:function(D,F){return F in D},get:l?function(D,F){return r.call(D,F)?D[F]:void 0}:function(D,F){return D[F]}},c=Object.getPrototypeOf(Function),f=typeof process=="object"&&process.env&&process.env.REFLECT_METADATA_USE_MAP_POLYFILL==="true",d=!f&&typeof Map=="function"&&typeof Map.prototype.entries=="function"?Map:wn(),m=!f&&typeof Set=="function"&&typeof Set.prototype.entries=="function"?Set:ms(),_=!f&&typeof WeakMap=="function"?WeakMap:hs(),x=new _;function A(D,F,q,Y){if(Se(q)){if(!Mt(D))throw new TypeError;if(!Tt(F))throw new TypeError;return Ce(D,F)}else{if(!Mt(D))throw new TypeError;if(!qe(F))throw new TypeError;if(!qe(Y)&&!Se(Y)&&!ar(Y))throw new TypeError;return ar(Y)&&(Y=void 0),q=Pt(q),j(D,F,q,Y)}}e("decorate",A);function I(D,F){function q(Y,ee){if(!qe(Y))throw new TypeError;if(!Se(ee)&&!hr(ee))throw new TypeError;$(D,F,Y,ee)}return q}e("metadata",I);function y(D,F,q,Y){if(!qe(q))throw new TypeError;return Se(Y)||(Y=Pt(Y)),$(D,F,q,Y)}e("defineMetadata",y);function g(D,F,q){if(!qe(F))throw new TypeError;return Se(q)||(q=Pt(q)),V(D,F,q)}e("hasMetadata",g);function O(D,F,q){if(!qe(F))throw new TypeError;return Se(q)||(q=Pt(q)),G(D,F,q)}e("hasOwnMetadata",O);function M(D,F,q){if(!qe(F))throw new TypeError;return Se(q)||(q=Pt(q)),ie(D,F,q)}e("getMetadata",M);function J(D,F,q){if(!qe(F))throw new TypeError;return Se(q)||(q=Pt(q)),z(D,F,q)}e("getOwnMetadata",J);function ce(D,F){if(!qe(D))throw new TypeError;return Se(F)||(F=Pt(F)),w(D,F)}e("getMetadataKeys",ce);function _e(D,F){if(!qe(D))throw new TypeError;return Se(F)||(F=Pt(F)),le(D,F)}e("getOwnMetadataKeys",_e);function je(D,F,q){if(!qe(F))throw new TypeError;Se(q)||(q=Pt(q));var Y=k(F,q,!1);if(Se(Y)||!Y.delete(D))return!1;if(Y.size>0)return!0;var ee=x.get(F);return ee.delete(q),ee.size>0||x.delete(F),!0}e("deleteMetadata",je);function Ce(D,F){for(var q=D.length-1;q>=0;--q){var Y=D[q],ee=Y(F);if(!Se(ee)&&!ar(ee)){if(!Tt(ee))throw new TypeError;F=ee}}return F}function j(D,F,q,Y){for(var ee=D.length-1;ee>=0;--ee){var R=D[ee],L=R(F,q,Y);if(!Se(L)&&!ar(L)){if(!qe(L))throw new TypeError;Y=L}}return Y}function k(D,F,q){var Y=x.get(D);if(Se(Y)){if(!q)return;Y=new d,x.set(D,Y)}var ee=Y.get(F);if(Se(ee)){if(!q)return;ee=new d,Y.set(F,ee)}return ee}function V(D,F,q){var Y=G(D,F,q);if(Y)return!0;var ee=Qr(F);return ar(ee)?!1:V(D,ee,q)}function G(D,F,q){var Y=k(F,q,!1);return Se(Y)?!1:ht(Y.has(D))}function ie(D,F,q){var Y=G(D,F,q);if(Y)return z(D,F,q);var ee=Qr(F);if(!ar(ee))return ie(D,ee,q)}function z(D,F,q){var Y=k(F,q,!1);if(!Se(Y))return Y.get(D)}function $(D,F,q,Y){var ee=k(q,Y,!0);ee.set(D,F)}function w(D,F){var q=le(D,F),Y=Qr(D);if(Y===null)return q;var ee=w(Y,F);if(ee.length<=0)return q;if(q.length<=0)return ee;for(var R=new m,L=[],U=0,B=q;U<B.length;U++){var oe=B[U],ne=R.has(oe);ne||(R.add(oe),L.push(oe))}for(var xe=0,He=ee;xe<He.length;xe++){var oe=He[xe],ne=R.has(oe);ne||(R.add(oe),L.push(oe))}return L}function le(D,F){var q=[],Y=k(D,F,!1);if(Se(Y))return q;for(var ee=Y.keys(),R=Jr(ee),L=0;;){var U=Oi(R);if(!U)return q.length=L,q;var B=ri(U);try{q[L]=B}catch(oe){try{ps(R)}finally{throw oe}}L++}}function he(D){if(D===null)return 1;switch(typeof D){case"undefined":return 0;case"boolean":return 2;case"string":return 3;case"symbol":return 4;case"number":return 5;case"object":return D===null?1:6;default:return 6}}function Se(D){return D===void 0}function ar(D){return D===null}function Ii(D){return typeof D=="symbol"}function qe(D){return typeof D=="object"?D!==null:typeof D=="function"}function Xt(D,F){switch(he(D)){case 0:return D;case 1:return D;case 2:return D;case 3:return D;case 4:return D;case 5:return D}var q=F===3?"string":F===5?"number":"default",Y=Ir(D,i);if(Y!==void 0){var ee=Y.call(D,q);if(qe(ee))throw new TypeError;return ee}return ti(D,q==="default"?"number":q)}function ti(D,F){if(F==="string"){var q=D.toString;if(gt(q)){var Y=q.call(D);if(!qe(Y))return Y}var ee=D.valueOf;if(gt(ee)){var Y=ee.call(D);if(!qe(Y))return Y}}else{var ee=D.valueOf;if(gt(ee)){var Y=ee.call(D);if(!qe(Y))return Y}var R=D.toString;if(gt(R)){var Y=R.call(D);if(!qe(Y))return Y}}throw new TypeError}function ht(D){return!!D}function Jt(D){return""+D}function Pt(D){var F=Xt(D,3);return Ii(F)?F:Jt(F)}function Mt(D){return Array.isArray?Array.isArray(D):D instanceof Object?D instanceof Array:Object.prototype.toString.call(D)==="[object Array]"}function gt(D){return typeof D=="function"}function Tt(D){return typeof D=="function"}function hr(D){switch(he(D)){case 3:return!0;case 4:return!0;default:return!1}}function Ir(D,F){var q=D[F];if(q!=null){if(!gt(q))throw new TypeError;return q}}function Jr(D){var F=Ir(D,o);if(!gt(F))throw new TypeError;var q=F.call(D);if(!qe(q))throw new TypeError;return q}function ri(D){return D.value}function Oi(D){var F=D.next();return F.done?!1:F}function ps(D){var F=D.return;F&&F.call(D)}function Qr(D){var F=Object.getPrototypeOf(D);if(typeof D!="function"||D===c||F!==c)return F;var q=D.prototype,Y=q&&Object.getPrototypeOf(q);if(Y==null||Y===Object.prototype)return F;var ee=Y.constructor;return typeof ee!="function"||ee===D?F:ee}function wn(){var D={},F=[],q=function(){function L(U,B,oe){this._index=0,this._keys=U,this._values=B,this._selector=oe}return L.prototype["@@iterator"]=function(){return this},L.prototype[o]=function(){return this},L.prototype.next=function(){var U=this._index;if(U>=0&&U<this._keys.length){var B=this._selector(this._keys[U],this._values[U]);return U+1>=this._keys.length?(this._index=-1,this._keys=F,this._values=F):this._index++,{value:B,done:!1}}return{value:void 0,done:!0}},L.prototype.throw=function(U){throw this._index>=0&&(this._index=-1,this._keys=F,this._values=F),U},L.prototype.return=function(U){return this._index>=0&&(this._index=-1,this._keys=F,this._values=F),{value:U,done:!0}},L}();return function(){function L(){this._keys=[],this._values=[],this._cacheKey=D,this._cacheIndex=-2}return Object.defineProperty(L.prototype,"size",{get:function(){return this._keys.length},enumerable:!0,configurable:!0}),L.prototype.has=function(U){return this._find(U,!1)>=0},L.prototype.get=function(U){var B=this._find(U,!1);return B>=0?this._values[B]:void 0},L.prototype.set=function(U,B){var oe=this._find(U,!0);return this._values[oe]=B,this},L.prototype.delete=function(U){var B=this._find(U,!1);if(B>=0){for(var oe=this._keys.length,ne=B+1;ne<oe;ne++)this._keys[ne-1]=this._keys[ne],this._values[ne-1]=this._values[ne];return this._keys.length--,this._values.length--,U===this._cacheKey&&(this._cacheKey=D,this._cacheIndex=-2),!0}return!1},L.prototype.clear=function(){this._keys.length=0,this._values.length=0,this._cacheKey=D,this._cacheIndex=-2},L.prototype.keys=function(){return new q(this._keys,this._values,Y)},L.prototype.values=function(){return new q(this._keys,this._values,ee)},L.prototype.entries=function(){return new q(this._keys,this._values,R)},L.prototype["@@iterator"]=function(){return this.entries()},L.prototype[o]=function(){return this.entries()},L.prototype._find=function(U,B){return this._cacheKey!==U&&(this._cacheIndex=this._keys.indexOf(this._cacheKey=U)),this._cacheIndex<0&&B&&(this._cacheIndex=this._keys.length,this._keys.push(U),this._values.push(void 0)),this._cacheIndex},L}();function Y(L,U){return L}function ee(L,U){return U}function R(L,U){return[L,U]}}function ms(){return function(){function D(){this._map=new d}return Object.defineProperty(D.prototype,"size",{get:function(){return this._map.size},enumerable:!0,configurable:!0}),D.prototype.has=function(F){return this._map.has(F)},D.prototype.add=function(F){return this._map.set(F,F),this},D.prototype.delete=function(F){return this._map.delete(F)},D.prototype.clear=function(){this._map.clear()},D.prototype.keys=function(){return this._map.keys()},D.prototype.values=function(){return this._map.values()},D.prototype.entries=function(){return this._map.entries()},D.prototype["@@iterator"]=function(){return this.keys()},D.prototype[o]=function(){return this.keys()},D}()}function hs(){var D=16,F=u.create(),q=Y();return function(){function B(){this._key=Y()}return B.prototype.has=function(oe){var ne=ee(oe,!1);return ne!==void 0?u.has(ne,this._key):!1},B.prototype.get=function(oe){var ne=ee(oe,!1);return ne!==void 0?u.get(ne,this._key):void 0},B.prototype.set=function(oe,ne){var xe=ee(oe,!0);return xe[this._key]=ne,this},B.prototype.delete=function(oe){var ne=ee(oe,!1);return ne!==void 0?delete ne[this._key]:!1},B.prototype.clear=function(){this._key=Y()},B}();function Y(){var B;do B="@@WeakMap@@"+U();while(u.has(F,B));return F[B]=!0,B}function ee(B,oe){if(!r.call(B,q)){if(!oe)return;Object.defineProperty(B,q,{value:u.create()})}return B[q]}function R(B,oe){for(var ne=0;ne<oe;++ne)B[ne]=Math.random()*255|0;return B}function L(B){return typeof Uint8Array=="function"?typeof crypto!="undefined"?crypto.getRandomValues(new Uint8Array(B)):typeof msCrypto!="undefined"?msCrypto.getRandomValues(new Uint8Array(B)):R(new Uint8Array(B),B):R(new Array(B),B)}function U(){var B=L(D);B[6]=B[6]&79|64,B[8]=B[8]&191|128;for(var oe="",ne=0;ne<D;++ne){var xe=B[ne];(ne===4||ne===6||ne===8)&&(oe+="-"),xe<16&&(oe+="0"),oe+=xe.toString(16).toLowerCase()}return oe}}function Pr(D){return D.__=void 0,delete D.__,D}})})(O_||(O_={}));var Js=yt(Or(),1);var st={};Ai(st,{AbstractElement:()=>Zh,AbstractRule:()=>Rl,AbstractType:()=>xl,Action:()=>Ag,Alternatives:()=>Sg,ArrayLiteral:()=>eg,ArrayType:()=>tg,Assignment:()=>Dg,BooleanLiteral:()=>ng,CharacterRange:()=>Cg,Condition:()=>ff,Conjunction:()=>og,CrossReference:()=>Lg,Disjunction:()=>ag,EndOfFile:()=>kg,Grammar:()=>ug,GrammarImport:()=>YN,Group:()=>$g,InferredType:()=>cg,Interface:()=>fg,Keyword:()=>Pg,LangiumGrammarAstReflection:()=>Us,LangiumGrammarTerminals:()=>rw,NamedArgument:()=>XN,NegatedToken:()=>Mg,Negation:()=>dg,NumberLiteral:()=>mg,Parameter:()=>hg,ParameterReference:()=>gg,ParserRule:()=>yg,ReferenceType:()=>_g,RegexToken:()=>Ug,ReturnType:()=>JN,RuleCall:()=>Bg,SimpleType:()=>xg,StringLiteral:()=>Ng,TerminalAlternatives:()=>Wg,TerminalGroup:()=>jg,TerminalRule:()=>pf,TerminalRuleCall:()=>Hg,Type:()=>Eg,TypeAttribute:()=>QN,TypeDefinition:()=>Qh,UnionType:()=>Ig,UnorderedGroup:()=>Kg,UntilToken:()=>zg,ValueLiteral:()=>df,Wildcard:()=>Xg,isAbstractElement:()=>Oo,isAbstractRule:()=>nw,isAbstractType:()=>iw,isAction:()=>In,isAlternatives:()=>Vs,isArrayLiteral:()=>uw,isArrayType:()=>rg,isAssignment:()=>vr,isBooleanLiteral:()=>ig,isCharacterRange:()=>bg,isCondition:()=>ow,isConjunction:()=>sg,isCrossReference:()=>On,isDisjunction:()=>lg,isEndOfFile:()=>wg,isFeatureName:()=>sw,isGrammar:()=>cw,isGrammarImport:()=>fw,isGroup:()=>fn,isInferredType:()=>mf,isInterface:()=>hf,isKeyword:()=>ur,isNamedArgument:()=>dw,isNegatedToken:()=>Fg,isNegation:()=>pg,isNumberLiteral:()=>pw,isParameter:()=>mw,isParameterReference:()=>Tg,isParserRule:()=>Ct,isPrimitiveType:()=>zN,isReferenceType:()=>vg,isRegexToken:()=>Vg,isReturnType:()=>Rg,isRuleCall:()=>Gr,isSimpleType:()=>gf,isStringLiteral:()=>hw,isTerminalAlternatives:()=>Gg,isTerminalGroup:()=>qg,isTerminalRule:()=>Wr,isTerminalRuleCall:()=>Tf,isType:()=>Nl,isTypeAttribute:()=>gw,isTypeDefinition:()=>aw,isUnionType:()=>Og,isUnorderedGroup:()=>Bs,isUntilToken:()=>Yg,isValueLiteral:()=>lw,isWildcard:()=>Jg,reflection:()=>me});function Be(t){return typeof t=="object"&&t!==null&&typeof t.$type=="string"}function Rt(t){return typeof t=="object"&&t!==null&&typeof t.$refText=="string"}function _l(t){return typeof t=="object"&&t!==null&&typeof t.name=="string"&&typeof t.type=="string"&&typeof t.path=="string"}function Nn(t){return typeof t=="object"&&t!==null&&Be(t.container)&&Rt(t.reference)&&typeof t.message=="string"}var Io=class{constructor(){this.subtypes={},this.allSubtypes={}}isInstance(e,r){return Be(e)&&this.isSubtype(e.$type,r)}isSubtype(e,r){if(e===r)return!0;let n=this.subtypes[e];n||(n=this.subtypes[e]={});let i=n[r];if(i!==void 0)return i;{let o=this.computeIsSubtype(e,r);return n[r]=o,o}}getAllSubTypes(e){let r=this.allSubtypes[e];if(r)return r;{let n=this.getAllTypes(),i=[];for(let o of n)this.isSubtype(o,e)&&i.push(o);return this.allSubtypes[e]=i,i}}};function Ar(t){return typeof t=="object"&&t!==null&&Array.isArray(t.content)}function En(t){return typeof t=="object"&&t!==null&&typeof t.tokenType=="object"}function vl(t){return Ar(t)&&typeof t.fullText=="string"}var rw={ID:/\^?[_a-zA-Z][\w_]*/,STRING:/"(\\.|[^"\\])*"|'(\\.|[^'\\])*'/,NUMBER:/NaN|-?((\d*\.\d+|\d+)([Ee][+-]?\d+)?|Infinity)/,RegexLiteral:/\/(?![*+?])(?:[^\r\n\[/\\]|\\.|\[(?:[^\r\n\]\\]|\\.)*\])+\/[a-z]*/,WS:/\s+/,ML_COMMENT:/\/\*[\s\S]*?\*\//,SL_COMMENT:/\/\/[^\n\r]*/},Rl="AbstractRule";function nw(t){return me.isInstance(t,Rl)}var xl="AbstractType";function iw(t){return me.isInstance(t,xl)}var ff="Condition";function ow(t){return me.isInstance(t,ff)}function sw(t){return zN(t)||t==="current"||t==="entry"||t==="extends"||t==="false"||t==="fragment"||t==="grammar"||t==="hidden"||t==="import"||t==="interface"||t==="returns"||t==="terminal"||t==="true"||t==="type"||t==="infer"||t==="infers"||t==="with"||typeof t=="string"&&/\^?[_a-zA-Z][\w_]*/.test(t)}function zN(t){return t==="string"||t==="number"||t==="boolean"||t==="Date"||t==="bigint"}var Qh="TypeDefinition";function aw(t){return me.isInstance(t,Qh)}var df="ValueLiteral";function lw(t){return me.isInstance(t,df)}var Zh="AbstractElement";function Oo(t){return me.isInstance(t,Zh)}var eg="ArrayLiteral";function uw(t){return me.isInstance(t,eg)}var tg="ArrayType";function rg(t){return me.isInstance(t,tg)}var ng="BooleanLiteral";function ig(t){return me.isInstance(t,ng)}var og="Conjunction";function sg(t){return me.isInstance(t,og)}var ag="Disjunction";function lg(t){return me.isInstance(t,ag)}var ug="Grammar";function cw(t){return me.isInstance(t,ug)}var YN="GrammarImport";function fw(t){return me.isInstance(t,YN)}var cg="InferredType";function mf(t){return me.isInstance(t,cg)}var fg="Interface";function hf(t){return me.isInstance(t,fg)}var XN="NamedArgument";function dw(t){return me.isInstance(t,XN)}var dg="Negation";function pg(t){return me.isInstance(t,dg)}var mg="NumberLiteral";function pw(t){return me.isInstance(t,mg)}var hg="Parameter";function mw(t){return me.isInstance(t,hg)}var gg="ParameterReference";function Tg(t){return me.isInstance(t,gg)}var yg="ParserRule";function Ct(t){return me.isInstance(t,yg)}var _g="ReferenceType";function vg(t){return me.isInstance(t,_g)}var JN="ReturnType";function Rg(t){return me.isInstance(t,JN)}var xg="SimpleType";function gf(t){return me.isInstance(t,xg)}var Ng="StringLiteral";function hw(t){return me.isInstance(t,Ng)}var pf="TerminalRule";function Wr(t){return me.isInstance(t,pf)}var Eg="Type";function Nl(t){return me.isInstance(t,Eg)}var QN="TypeAttribute";function gw(t){return me.isInstance(t,QN)}var Ig="UnionType";function Og(t){return me.isInstance(t,Ig)}var Ag="Action";function In(t){return me.isInstance(t,Ag)}var Sg="Alternatives";function Vs(t){return me.isInstance(t,Sg)}var Dg="Assignment";function vr(t){return me.isInstance(t,Dg)}var Cg="CharacterRange";function bg(t){return me.isInstance(t,Cg)}var Lg="CrossReference";function On(t){return me.isInstance(t,Lg)}var kg="EndOfFile";function wg(t){return me.isInstance(t,kg)}var $g="Group";function fn(t){return me.isInstance(t,$g)}var Pg="Keyword";function ur(t){return me.isInstance(t,Pg)}var Mg="NegatedToken";function Fg(t){return me.isInstance(t,Mg)}var Ug="RegexToken";function Vg(t){return me.isInstance(t,Ug)}var Bg="RuleCall";function Gr(t){return me.isInstance(t,Bg)}var Wg="TerminalAlternatives";function Gg(t){return me.isInstance(t,Wg)}var jg="TerminalGroup";function qg(t){return me.isInstance(t,jg)}var Hg="TerminalRuleCall";function Tf(t){return me.isInstance(t,Hg)}var Kg="UnorderedGroup";function Bs(t){return me.isInstance(t,Kg)}var zg="UntilToken";function Yg(t){return me.isInstance(t,zg)}var Xg="Wildcard";function Jg(t){return me.isInstance(t,Xg)}var Us=class extends Io{getAllTypes(){return["AbstractElement","AbstractRule","AbstractType","Action","Alternatives","ArrayLiteral","ArrayType","Assignment","BooleanLiteral","CharacterRange","Condition","Conjunction","CrossReference","Disjunction","EndOfFile","Grammar","GrammarImport","Group","InferredType","Interface","Keyword","NamedArgument","NegatedToken","Negation","NumberLiteral","Parameter","ParameterReference","ParserRule","ReferenceType","RegexToken","ReturnType","RuleCall","SimpleType","StringLiteral","TerminalAlternatives","TerminalGroup","TerminalRule","TerminalRuleCall","Type","TypeAttribute","TypeDefinition","UnionType","UnorderedGroup","UntilToken","ValueLiteral","Wildcard"]}computeIsSubtype(e,r){switch(e){case Ag:case Sg:case Dg:case Cg:case Lg:case kg:case $g:case Pg:case Mg:case Ug:case Bg:case Wg:case jg:case Hg:case Kg:case zg:case Xg:return this.isSubtype(Zh,r);case eg:case mg:case Ng:return this.isSubtype(df,r);case tg:case _g:case xg:case Ig:return this.isSubtype(Qh,r);case ng:return this.isSubtype(ff,r)||this.isSubtype(df,r);case og:case ag:case dg:case gg:return this.isSubtype(ff,r);case cg:case fg:case Eg:return this.isSubtype(xl,r);case yg:return this.isSubtype(Rl,r)||this.isSubtype(xl,r);case pf:return this.isSubtype(Rl,r);default:return!1}}getReferenceType(e){let r=`${e.container.$type}:${e.property}`;switch(r){case"Action:type":case"CrossReference:type":case"Interface:superTypes":case"ParserRule:returnType":case"SimpleType:typeRef":return xl;case"Grammar:hiddenTokens":case"ParserRule:hiddenTokens":case"RuleCall:rule":return Rl;case"Grammar:usedGrammars":return ug;case"NamedArgument:parameter":case"ParameterReference:parameter":return hg;case"TerminalRuleCall:rule":return pf;default:throw new Error(`${r} is not a valid reference id.`)}}getTypeMetaData(e){switch(e){case"AbstractElement":return{name:"AbstractElement",properties:[{name:"cardinality"},{name:"lookahead"}]};case"ArrayLiteral":return{name:"ArrayLiteral",properties:[{name:"elements",defaultValue:[]}]};case"ArrayType":return{name:"ArrayType",properties:[{name:"elementType"}]};case"BooleanLiteral":return{name:"BooleanLiteral",properties:[{name:"true",defaultValue:!1}]};case"Conjunction":return{name:"Conjunction",properties:[{name:"left"},{name:"right"}]};case"Disjunction":return{name:"Disjunction",properties:[{name:"left"},{name:"right"}]};case"Grammar":return{name:"Grammar",properties:[{name:"definesHiddenTokens",defaultValue:!1},{name:"hiddenTokens",defaultValue:[]},{name:"imports",defaultValue:[]},{name:"interfaces",defaultValue:[]},{name:"isDeclared",defaultValue:!1},{name:"name"},{name:"rules",defaultValue:[]},{name:"types",defaultValue:[]},{name:"usedGrammars",defaultValue:[]}]};case"GrammarImport":return{name:"GrammarImport",properties:[{name:"path"}]};case"InferredType":return{name:"InferredType",properties:[{name:"name"}]};case"Interface":return{name:"Interface",properties:[{name:"attributes",defaultValue:[]},{name:"name"},{name:"superTypes",defaultValue:[]}]};case"NamedArgument":return{name:"NamedArgument",properties:[{name:"calledByName",defaultValue:!1},{name:"parameter"},{name:"value"}]};case"Negation":return{name:"Negation",properties:[{name:"value"}]};case"NumberLiteral":return{name:"NumberLiteral",properties:[{name:"value"}]};case"Parameter":return{name:"Parameter",properties:[{name:"name"}]};case"ParameterReference":return{name:"ParameterReference",properties:[{name:"parameter"}]};case"ParserRule":return{name:"ParserRule",properties:[{name:"dataType"},{name:"definesHiddenTokens",defaultValue:!1},{name:"definition"},{name:"entry",defaultValue:!1},{name:"fragment",defaultValue:!1},{name:"hiddenTokens",defaultValue:[]},{name:"inferredType"},{name:"name"},{name:"parameters",defaultValue:[]},{name:"returnType"},{name:"wildcard",defaultValue:!1}]};case"ReferenceType":return{name:"ReferenceType",properties:[{name:"referenceType"}]};case"ReturnType":return{name:"ReturnType",properties:[{name:"name"}]};case"SimpleType":return{name:"SimpleType",properties:[{name:"primitiveType"},{name:"stringType"},{name:"typeRef"}]};case"StringLiteral":return{name:"StringLiteral",properties:[{name:"value"}]};case"TerminalRule":return{name:"TerminalRule",properties:[{name:"definition"},{name:"fragment",defaultValue:!1},{name:"hidden",defaultValue:!1},{name:"name"},{name:"type"}]};case"Type":return{name:"Type",properties:[{name:"name"},{name:"type"}]};case"TypeAttribute":return{name:"TypeAttribute",properties:[{name:"defaultValue"},{name:"isOptional",defaultValue:!1},{name:"name"},{name:"type"}]};case"UnionType":return{name:"UnionType",properties:[{name:"types",defaultValue:[]}]};case"Action":return{name:"Action",properties:[{name:"cardinality"},{name:"feature"},{name:"inferredType"},{name:"lookahead"},{name:"operator"},{name:"type"}]};case"Alternatives":return{name:"Alternatives",properties:[{name:"cardinality"},{name:"elements",defaultValue:[]},{name:"lookahead"}]};case"Assignment":return{name:"Assignment",properties:[{name:"cardinality"},{name:"feature"},{name:"lookahead"},{name:"operator"},{name:"terminal"}]};case"CharacterRange":return{name:"CharacterRange",properties:[{name:"cardinality"},{name:"left"},{name:"lookahead"},{name:"right"}]};case"CrossReference":return{name:"CrossReference",properties:[{name:"cardinality"},{name:"deprecatedSyntax",defaultValue:!1},{name:"lookahead"},{name:"terminal"},{name:"type"}]};case"EndOfFile":return{name:"EndOfFile",properties:[{name:"cardinality"},{name:"lookahead"}]};case"Group":return{name:"Group",properties:[{name:"cardinality"},{name:"elements",defaultValue:[]},{name:"guardCondition"},{name:"lookahead"}]};case"Keyword":return{name:"Keyword",properties:[{name:"cardinality"},{name:"lookahead"},{name:"value"}]};case"NegatedToken":return{name:"NegatedToken",properties:[{name:"cardinality"},{name:"lookahead"},{name:"terminal"}]};case"RegexToken":return{name:"RegexToken",properties:[{name:"cardinality"},{name:"lookahead"},{name:"regex"}]};case"RuleCall":return{name:"RuleCall",properties:[{name:"arguments",defaultValue:[]},{name:"cardinality"},{name:"lookahead"},{name:"rule"}]};case"TerminalAlternatives":return{name:"TerminalAlternatives",properties:[{name:"cardinality"},{name:"elements",defaultValue:[]},{name:"lookahead"}]};case"TerminalGroup":return{name:"TerminalGroup",properties:[{name:"cardinality"},{name:"elements",defaultValue:[]},{name:"lookahead"}]};case"TerminalRuleCall":return{name:"TerminalRuleCall",properties:[{name:"cardinality"},{name:"lookahead"},{name:"rule"}]};case"UnorderedGroup":return{name:"UnorderedGroup",properties:[{name:"cardinality"},{name:"elements",defaultValue:[]},{name:"lookahead"}]};case"UntilToken":return{name:"UntilToken",properties:[{name:"cardinality"},{name:"lookahead"},{name:"terminal"}]};case"Wildcard":return{name:"Wildcard",properties:[{name:"cardinality"},{name:"lookahead"}]};default:return{name:e,properties:[]}}}},me=new Us;var Qt={};Ai(Qt,{assignMandatoryProperties:()=>Ol,copyAstNode:()=>oT,findLocalReferences:()=>Rw,findRootNode:()=>nE,getContainerOfType:()=>tn,getDocument:()=>xt,hasContainerOfType:()=>vw,linkContentToContainer:()=>Rf,streamAllContents:()=>jr,streamAst:()=>qr,streamContents:()=>Do,streamReferences:()=>js});var Sr=class t{constructor(e,r){this.startFn=e,this.nextFn=r}iterator(){let e={state:this.startFn(),next:()=>this.nextFn(e.state),[Symbol.iterator]:()=>e};return e}[Symbol.iterator](){return this.iterator()}isEmpty(){return!!this.iterator().next().done}count(){let e=this.iterator(),r=0,n=e.next();for(;!n.done;)r++,n=e.next();return r}toArray(){let e=[],r=this.iterator(),n;do n=r.next(),n.value!==void 0&&e.push(n.value);while(!n.done);return e}toSet(){return new Set(this)}toMap(e,r){let n=this.map(i=>[e?e(i):i,r?r(i):i]);return new Map(n)}toString(){return this.join()}concat(e){let r=e[Symbol.iterator]();return new t(()=>({first:this.startFn(),firstDone:!1}),n=>{let i;if(!n.firstDone){do if(i=this.nextFn(n.first),!i.done)return i;while(!i.done);n.firstDone=!0}do if(i=r.next(),!i.done)return i;while(!i.done);return cr})}join(e=","){let r=this.iterator(),n="",i,o=!1;do i=r.next(),i.done||(o&&(n+=e),n+=Tw(i.value)),o=!0;while(!i.done);return n}indexOf(e,r=0){let n=this.iterator(),i=0,o=n.next();for(;!o.done;){if(i>=r&&o.value===e)return i;o=n.next(),i++}return-1}every(e){let r=this.iterator(),n=r.next();for(;!n.done;){if(!e(n.value))return!1;n=r.next()}return!0}some(e){let r=this.iterator(),n=r.next();for(;!n.done;){if(e(n.value))return!0;n=r.next()}return!1}forEach(e){let r=this.iterator(),n=0,i=r.next();for(;!i.done;)e(i.value,n),i=r.next(),n++}map(e){return new t(this.startFn,r=>{let{done:n,value:i}=this.nextFn(r);return n?cr:{done:!1,value:e(i)}})}filter(e){return new t(this.startFn,r=>{let n;do if(n=this.nextFn(r),!n.done&&e(n.value))return n;while(!n.done);return cr})}nonNullable(){return this.filter(e=>e!=null)}reduce(e,r){let n=this.iterator(),i=r,o=n.next();for(;!o.done;)i===void 0?i=o.value:i=e(i,o.value),o=n.next();return i}reduceRight(e,r){return this.recursiveReduce(this.iterator(),e,r)}recursiveReduce(e,r,n){let i=e.next();if(i.done)return n;let o=this.recursiveReduce(e,r,n);return o===void 0?i.value:r(o,i.value)}find(e){let r=this.iterator(),n=r.next();for(;!n.done;){if(e(n.value))return n.value;n=r.next()}}findIndex(e){let r=this.iterator(),n=0,i=r.next();for(;!i.done;){if(e(i.value))return n;i=r.next(),n++}return-1}includes(e){let r=this.iterator(),n=r.next();for(;!n.done;){if(n.value===e)return!0;n=r.next()}return!1}flatMap(e){return new t(()=>({this:this.startFn()}),r=>{do{if(r.iterator){let o=r.iterator.next();if(o.done)r.iterator=void 0;else return o}let{done:n,value:i}=this.nextFn(r.this);if(!n){let o=e(i);if(yf(o))r.iterator=o[Symbol.iterator]();else return{done:!1,value:o}}}while(r.iterator);return cr})}flat(e){if(e===void 0&&(e=1),e<=0)return this;let r=e>1?this.flat(e-1):this;return new t(()=>({this:r.startFn()}),n=>{do{if(n.iterator){let s=n.iterator.next();if(s.done)n.iterator=void 0;else return s}let{done:i,value:o}=r.nextFn(n.this);if(!i)if(yf(o))n.iterator=o[Symbol.iterator]();else return{done:!1,value:o}}while(n.iterator);return cr})}head(){let r=this.iterator().next();if(!r.done)return r.value}tail(e=1){return new t(()=>{let r=this.startFn();for(let n=0;n<e;n++)if(this.nextFn(r).done)return r;return r},this.nextFn)}limit(e){return new t(()=>({size:0,state:this.startFn()}),r=>(r.size++,r.size>e?cr:this.nextFn(r.state)))}distinct(e){let r=new Set;return this.filter(n=>{let i=e?e(n):n;return r.has(i)?!1:(r.add(i),!0)})}exclude(e,r){let n=new Set;for(let i of e){let o=r?r(i):i;n.add(o)}return this.filter(i=>{let o=r?r(i):i;return!n.has(o)})}};function Tw(t){return typeof t=="string"?t:typeof t=="undefined"?"undefined":typeof t.toString=="function"?t.toString():Object.prototype.toString.call(t)}function yf(t){return!!t&&typeof t[Symbol.iterator]=="function"}var Bi=new Sr(()=>{},()=>cr),cr=Object.freeze({done:!0,value:void 0});function pe(...t){if(t.length===1){let e=t[0];if(e instanceof Sr)return e;if(yf(e))return new Sr(()=>e[Symbol.iterator](),r=>r.next());if(typeof e.length=="number")return new Sr(()=>({index:0}),r=>r.index<e.length?{done:!1,value:e[r.index++]}:cr)}return t.length>1?new Sr(()=>({collIndex:0,arrIndex:0}),e=>{do{if(e.iterator){let r=e.iterator.next();if(!r.done)return r;e.iterator=void 0}if(e.array){if(e.arrIndex<e.array.length)return{done:!1,value:e.array[e.arrIndex++]};e.array=void 0,e.arrIndex=0}if(e.collIndex<t.length){let r=t[e.collIndex++];yf(r)?e.iterator=r[Symbol.iterator]():r&&typeof r.length=="number"&&(e.array=r)}}while(e.iterator||e.array||e.collIndex<t.length);return cr}):Bi}var dn=class extends Sr{constructor(e,r,n){super(()=>({iterators:n!=null&&n.includeRoot?[[e][Symbol.iterator]()]:[r(e)[Symbol.iterator]()],pruned:!1}),i=>{for(i.pruned&&(i.iterators.pop(),i.pruned=!1);i.iterators.length>0;){let s=i.iterators[i.iterators.length-1].next();if(s.done)i.iterators.pop();else return i.iterators.push(r(s.value)[Symbol.iterator]()),s}return cr})}iterator(){let e={state:this.startFn(),next:()=>this.nextFn(e.state),prune:()=>{e.state.pruned=!0},[Symbol.iterator]:()=>e};return e}},Ws;(function(t){function e(o){return o.reduce((s,a)=>s+a,0)}t.sum=e;function r(o){return o.reduce((s,a)=>s*a,0)}t.product=r;function n(o){return o.reduce((s,a)=>Math.min(s,a))}t.min=n;function i(o){return o.reduce((s,a)=>Math.max(s,a))}t.max=i})(Ws||(Ws={}));var Wi={};Ai(Wi,{DefaultNameRegexp:()=>vf,RangeComparison:()=>si,compareRange:()=>eE,findCommentNode:()=>tT,findDeclarationNodeAtOffset:()=>rr,findLeafNodeAtOffset:()=>El,findLeafNodeBeforeOffset:()=>Il,flattenCst:()=>Zg,getInteriorNodes:()=>nT,getNextNode:()=>rT,getPreviousNode:()=>rE,getStartlineNode:()=>yw,inRange:()=>_f,isChildNode:()=>eT,isCommentNode:()=>Qg,streamCst:()=>Ao,toDocumentSegment:()=>So,tokenToRange:()=>Gs});function Ao(t){return new dn(t,e=>Ar(e)?e.content:[],{includeRoot:!0})}function Zg(t){return Ao(t).filter(En)}function eT(t,e){for(;t.container;)if(t=t.container,t===e)return!0;return!1}function Gs(t){return{start:{character:t.startColumn-1,line:t.startLine-1},end:{character:t.endColumn,line:t.endLine-1}}}function So(t){if(!t)return;let{offset:e,end:r,range:n}=t;return{range:n,offset:e,end:r,length:r-e}}var si;(function(t){t[t.Before=0]="Before",t[t.After=1]="After",t[t.OverlapFront=2]="OverlapFront",t[t.OverlapBack=3]="OverlapBack",t[t.Inside=4]="Inside"})(si||(si={}));function eE(t,e){if(t.end.line<e.start.line||t.end.line===e.start.line&&t.end.character<t.start.character)return si.Before;if(t.start.line>e.end.line||t.start.line===e.end.line&&t.start.character>e.end.character)return si.After;let r=t.start.line>e.start.line||t.start.line===e.start.line&&t.start.character>=e.start.character,n=t.end.line<e.end.line||t.end.line===e.end.line&&t.end.character<=e.end.character;return r&&n?si.Inside:r?si.OverlapBack:si.OverlapFront}function _f(t,e){return eE(t,e)>si.After}var vf=/^[\w\p{L}]$/u;function rr(t,e,r=vf){if(t){if(e>0){let n=e-t.offset,i=t.text.charAt(n);r.test(i)||e--}return El(t,e)}}function tT(t,e){if(t){let r=rE(t,!0);if(r&&Qg(r,e))return r;if(vl(t)){let n=t.content.findIndex(i=>!i.hidden);for(let i=n-1;i>=0;i--){let o=t.content[i];if(Qg(o,e))return o}}}}function Qg(t,e){return En(t)&&e.includes(t.tokenType.name)}function El(t,e){if(En(t))return t;if(Ar(t)){let r=tE(t,e,!1);if(r)return El(r,e)}}function Il(t,e){if(En(t))return t;if(Ar(t)){let r=tE(t,e,!0);if(r)return Il(r,e)}}function tE(t,e,r){let n=0,i=t.content.length-1,o;for(;n<=i;){let s=Math.floor((n+i)/2),a=t.content[s];if(a.offset<=e&&a.end>e)return a;a.end<=e?(o=r?a:void 0,n=s+1):i=s-1}return o}function rE(t,e=!0){for(;t.container;){let r=t.container,n=r.content.indexOf(t);for(;n>0;){n--;let i=r.content[n];if(e||!i.hidden)return i}t=r}}function rT(t,e=!0){for(;t.container;){let r=t.container,n=r.content.indexOf(t),i=r.content.length-1;for(;n<i;){n++;let o=r.content[n];if(e||!o.hidden)return o}t=r}}function yw(t){if(t.range.start.character===0)return t;let e=t.range.start.line,r=t,n;for(;t.container;){let i=t.container,o=n!=null?n:i.content.indexOf(t);if(o===0?(t=i,n=void 0):(n=o-1,t=i.content[n]),t.range.start.line!==e)break;r=t}return r}function nT(t,e){let r=_w(t,e);return r?r.parent.content.slice(r.a+1,r.b):[]}function _w(t,e){let r=ZN(t),n=ZN(e),i;for(let o=0;o<r.length&&o<n.length;o++){let s=r[o],a=n[o];if(s.parent===a.parent)i={parent:s.parent,a:s.index,b:a.index};else break}return i}function ZN(t){let e=[];for(;t.container;){let r=t.container,n=r.content.indexOf(t);e.push({parent:r,index:n}),t=r}return e.reverse()}function Rf(t){for(let[e,r]of Object.entries(t))e.startsWith("$")||(Array.isArray(r)?r.forEach((n,i)=>{Be(n)&&(n.$container=t,n.$containerProperty=e,n.$containerIndex=i)}):Be(r)&&(r.$container=t,r.$containerProperty=e))}function tn(t,e){let r=t;for(;r;){if(e(r))return r;r=r.$container}}function vw(t,e){let r=t;for(;r;){if(e(r))return!0;r=r.$container}return!1}function xt(t){let r=nE(t).$document;if(!r)throw new Error("AST node has no document.");return r}function nE(t){for(;t.$container;)t=t.$container;return t}function Do(t,e){if(!t)throw new Error("Node must be an AstNode.");let r=e==null?void 0:e.range;return new Sr(()=>({keys:Object.keys(t),keyIndex:0,arrayIndex:0}),n=>{for(;n.keyIndex<n.keys.length;){let i=n.keys[n.keyIndex];if(!i.startsWith("$")){let o=t[i];if(Be(o)){if(n.keyIndex++,iT(o,r))return{done:!1,value:o}}else if(Array.isArray(o)){for(;n.arrayIndex<o.length;){let s=n.arrayIndex++,a=o[s];if(Be(a)&&iT(a,r))return{done:!1,value:a}}n.arrayIndex=0}}n.keyIndex++}return cr})}function jr(t,e){if(!t)throw new Error("Root node must be an AstNode.");return new dn(t,r=>Do(r,e))}function qr(t,e){if(t){if(e!=null&&e.range&&!iT(t,e.range))return new dn(t,()=>[])}else throw new Error("Root node must be an AstNode.");return new dn(t,r=>Do(r,e),{includeRoot:!0})}function iT(t,e){var r;if(!e)return!0;let n=(r=t.$cstNode)===null||r===void 0?void 0:r.range;return n?_f(n,e):!1}function js(t){return new Sr(()=>({keys:Object.keys(t),keyIndex:0,arrayIndex:0}),e=>{for(;e.keyIndex<e.keys.length;){let r=e.keys[e.keyIndex];if(!r.startsWith("$")){let n=t[r];if(Rt(n))return e.keyIndex++,{done:!1,value:{reference:n,container:t,property:r}};if(Array.isArray(n)){for(;e.arrayIndex<n.length;){let i=e.arrayIndex++,o=n[i];if(Rt(o))return{done:!1,value:{reference:o,container:t,property:r,index:i}}}e.arrayIndex=0}}e.keyIndex++}return cr})}function Rw(t,e=xt(t).parseResult.value){let r=[];return qr(e).forEach(n=>{js(n).forEach(i=>{i.reference.ref===t&&r.push(i.reference)})}),pe(r)}function Ol(t,e){let r=t.getTypeMetaData(e.$type),n=e;for(let i of r.properties)i.defaultValue!==void 0&&n[i.name]===void 0&&(n[i.name]=iE(i.defaultValue))}function iE(t){return Array.isArray(t)?[...t.map(iE)]:t}function oT(t,e){let r={$type:t.$type};for(let[n,i]of Object.entries(t))if(!n.startsWith("$"))if(Be(i))r[n]=oT(i,e);else if(Rt(i))r[n]=e(r,n,i.$refNode,i.$refText);else if(Array.isArray(i)){let o=[];for(let s of i)Be(s)?o.push(oT(s,e)):Rt(s)?o.push(e(r,n,s.$refNode,s.$refText)):o.push(s);r[n]=o}else r[n]=i;return Rf(r),r}var bt={};Ai(bt,{findAssignment:()=>yT,findNameAssignment:()=>Af,findNodeForKeyword:()=>Ks,findNodeForProperty:()=>ji,findNodesForKeyword:()=>Of,findNodesForKeywordInternal:()=>TT,findNodesForProperty:()=>Hs,getActionAtElement:()=>cE,getActionType:()=>dE,getAllReachableRules:()=>bl,getCrossReferenceTerminal:()=>Ll,getEntryRule:()=>Cl,getExplicitRuleType:()=>Po,getHiddenRules:()=>aE,getRuleType:()=>vT,getTypeName:()=>li,isArrayCardinality:()=>_T,isArrayOperator:()=>Iw,isCommentTerminal:()=>hT,isDataType:()=>Ow,isDataTypeRule:()=>kl,isOptionalCardinality:()=>$o,terminalRegex:()=>qi});var Co=class extends Error{constructor(e,r){super(e?`${r} at ${e.range.start.line}:${e.range.start.character}`:r)}};function Gi(t){throw new Error("Error! The input value was not handled.")}var If={};Ai(If,{NEWLINE_REGEXP:()=>uT,escapeRegExp:()=>wo,getCaseInsensitivePattern:()=>fT,getTerminalParts:()=>Ew,isMultilineComment:()=>cT,isWhitespace:()=>Ef,partialMatches:()=>dT,partialRegExp:()=>sE});function fe(t){return t.charCodeAt(0)}function xf(t,e){Array.isArray(t)?t.forEach(function(r){e.push(r)}):e.push(t)}function qs(t,e){if(t[e]===!0)throw"duplicate flag "+e;let r=t[e];t[e]=!0}function bo(t){if(t===void 0)throw Error("Internal Error - Should never get here!");return!0}function Al(){throw Error("Internal Error - Should never get here!")}function sT(t){return t.type==="Character"}var Sl=[];for(let t=fe("0");t<=fe("9");t++)Sl.push(t);var Dl=[fe("_")].concat(Sl);for(let t=fe("a");t<=fe("z");t++)Dl.push(t);for(let t=fe("A");t<=fe("Z");t++)Dl.push(t);var aT=[fe(" "),fe("\f"),fe(`
`),fe("\r"),fe("	"),fe("\v"),fe("	"),fe("\xA0"),fe("\u1680"),fe("\u2000"),fe("\u2001"),fe("\u2002"),fe("\u2003"),fe("\u2004"),fe("\u2005"),fe("\u2006"),fe("\u2007"),fe("\u2008"),fe("\u2009"),fe("\u200A"),fe("\u2028"),fe("\u2029"),fe("\u202F"),fe("\u205F"),fe("\u3000"),fe("\uFEFF")];var xw=/[0-9a-fA-F]/,Nf=/[0-9]/,Nw=/[1-9]/,Lo=class{constructor(){this.idx=0,this.input="",this.groupIdx=0}saveState(){return{idx:this.idx,input:this.input,groupIdx:this.groupIdx}}restoreState(e){this.idx=e.idx,this.input=e.input,this.groupIdx=e.groupIdx}pattern(e){this.idx=0,this.input=e,this.groupIdx=0,this.consumeChar("/");let r=this.disjunction();this.consumeChar("/");let n={type:"Flags",loc:{begin:this.idx,end:e.length},global:!1,ignoreCase:!1,multiLine:!1,unicode:!1,sticky:!1};for(;this.isRegExpFlag();)switch(this.popChar()){case"g":qs(n,"global");break;case"i":qs(n,"ignoreCase");break;case"m":qs(n,"multiLine");break;case"u":qs(n,"unicode");break;case"y":qs(n,"sticky");break}if(this.idx!==this.input.length)throw Error("Redundant input: "+this.input.substring(this.idx));return{type:"Pattern",flags:n,value:r,loc:this.loc(0)}}disjunction(){let e=[],r=this.idx;for(e.push(this.alternative());this.peekChar()==="|";)this.consumeChar("|"),e.push(this.alternative());return{type:"Disjunction",value:e,loc:this.loc(r)}}alternative(){let e=[],r=this.idx;for(;this.isTerm();)e.push(this.term());return{type:"Alternative",value:e,loc:this.loc(r)}}term(){return this.isAssertion()?this.assertion():this.atom()}assertion(){let e=this.idx;switch(this.popChar()){case"^":return{type:"StartAnchor",loc:this.loc(e)};case"$":return{type:"EndAnchor",loc:this.loc(e)};case"\\":switch(this.popChar()){case"b":return{type:"WordBoundary",loc:this.loc(e)};case"B":return{type:"NonWordBoundary",loc:this.loc(e)}}throw Error("Invalid Assertion Escape");case"(":this.consumeChar("?");let r;switch(this.popChar()){case"=":r="Lookahead";break;case"!":r="NegativeLookahead";break}bo(r);let n=this.disjunction();return this.consumeChar(")"),{type:r,value:n,loc:this.loc(e)}}return Al()}quantifier(e=!1){let r,n=this.idx;switch(this.popChar()){case"*":r={atLeast:0,atMost:1/0};break;case"+":r={atLeast:1,atMost:1/0};break;case"?":r={atLeast:0,atMost:1};break;case"{":let i=this.integerIncludingZero();switch(this.popChar()){case"}":r={atLeast:i,atMost:i};break;case",":let o;this.isDigit()?(o=this.integerIncludingZero(),r={atLeast:i,atMost:o}):r={atLeast:i,atMost:1/0},this.consumeChar("}");break}if(e===!0&&r===void 0)return;bo(r);break}if(!(e===!0&&r===void 0)&&bo(r))return this.peekChar(0)==="?"?(this.consumeChar("?"),r.greedy=!1):r.greedy=!0,r.type="Quantifier",r.loc=this.loc(n),r}atom(){let e,r=this.idx;switch(this.peekChar()){case".":e=this.dotAll();break;case"\\":e=this.atomEscape();break;case"[":e=this.characterClass();break;case"(":e=this.group();break}return e===void 0&&this.isPatternCharacter()&&(e=this.patternCharacter()),bo(e)?(e.loc=this.loc(r),this.isQuantifier()&&(e.quantifier=this.quantifier()),e):Al()}dotAll(){return this.consumeChar("."),{type:"Set",complement:!0,value:[fe(`
`),fe("\r"),fe("\u2028"),fe("\u2029")]}}atomEscape(){switch(this.consumeChar("\\"),this.peekChar()){case"1":case"2":case"3":case"4":case"5":case"6":case"7":case"8":case"9":return this.decimalEscapeAtom();case"d":case"D":case"s":case"S":case"w":case"W":return this.characterClassEscape();case"f":case"n":case"r":case"t":case"v":return this.controlEscapeAtom();case"c":return this.controlLetterEscapeAtom();case"0":return this.nulCharacterAtom();case"x":return this.hexEscapeSequenceAtom();case"u":return this.regExpUnicodeEscapeSequenceAtom();default:return this.identityEscapeAtom()}}decimalEscapeAtom(){return{type:"GroupBackReference",value:this.positiveInteger()}}characterClassEscape(){let e,r=!1;switch(this.popChar()){case"d":e=Sl;break;case"D":e=Sl,r=!0;break;case"s":e=aT;break;case"S":e=aT,r=!0;break;case"w":e=Dl;break;case"W":e=Dl,r=!0;break}return bo(e)?{type:"Set",value:e,complement:r}:Al()}controlEscapeAtom(){let e;switch(this.popChar()){case"f":e=fe("\f");break;case"n":e=fe(`
`);break;case"r":e=fe("\r");break;case"t":e=fe("	");break;case"v":e=fe("\v");break}return bo(e)?{type:"Character",value:e}:Al()}controlLetterEscapeAtom(){this.consumeChar("c");let e=this.popChar();if(/[a-zA-Z]/.test(e)===!1)throw Error("Invalid ");return{type:"Character",value:e.toUpperCase().charCodeAt(0)-64}}nulCharacterAtom(){return this.consumeChar("0"),{type:"Character",value:fe("\0")}}hexEscapeSequenceAtom(){return this.consumeChar("x"),this.parseHexDigits(2)}regExpUnicodeEscapeSequenceAtom(){return this.consumeChar("u"),this.parseHexDigits(4)}identityEscapeAtom(){let e=this.popChar();return{type:"Character",value:fe(e)}}classPatternCharacterAtom(){switch(this.peekChar()){case`
`:case"\r":case"\u2028":case"\u2029":case"\\":case"]":throw Error("TBD");default:let e=this.popChar();return{type:"Character",value:fe(e)}}}characterClass(){let e=[],r=!1;for(this.consumeChar("["),this.peekChar(0)==="^"&&(this.consumeChar("^"),r=!0);this.isClassAtom();){let n=this.classAtom(),i=n.type==="Character";if(sT(n)&&this.isRangeDash()){this.consumeChar("-");let o=this.classAtom(),s=o.type==="Character";if(sT(o)){if(o.value<n.value)throw Error("Range out of order in character class");e.push({from:n.value,to:o.value})}else xf(n.value,e),e.push(fe("-")),xf(o.value,e)}else xf(n.value,e)}return this.consumeChar("]"),{type:"Set",complement:r,value:e}}classAtom(){switch(this.peekChar()){case"]":case`
`:case"\r":case"\u2028":case"\u2029":throw Error("TBD");case"\\":return this.classEscape();default:return this.classPatternCharacterAtom()}}classEscape(){switch(this.consumeChar("\\"),this.peekChar()){case"b":return this.consumeChar("b"),{type:"Character",value:fe("\b")};case"d":case"D":case"s":case"S":case"w":case"W":return this.characterClassEscape();case"f":case"n":case"r":case"t":case"v":return this.controlEscapeAtom();case"c":return this.controlLetterEscapeAtom();case"0":return this.nulCharacterAtom();case"x":return this.hexEscapeSequenceAtom();case"u":return this.regExpUnicodeEscapeSequenceAtom();default:return this.identityEscapeAtom()}}group(){let e=!0;switch(this.consumeChar("("),this.peekChar(0)){case"?":this.consumeChar("?"),this.consumeChar(":"),e=!1;break;default:this.groupIdx++;break}let r=this.disjunction();this.consumeChar(")");let n={type:"Group",capturing:e,value:r};return e&&(n.idx=this.groupIdx),n}positiveInteger(){let e=this.popChar();if(Nw.test(e)===!1)throw Error("Expecting a positive integer");for(;Nf.test(this.peekChar(0));)e+=this.popChar();return parseInt(e,10)}integerIncludingZero(){let e=this.popChar();if(Nf.test(e)===!1)throw Error("Expecting an integer");for(;Nf.test(this.peekChar(0));)e+=this.popChar();return parseInt(e,10)}patternCharacter(){let e=this.popChar();switch(e){case`
`:case"\r":case"\u2028":case"\u2029":case"^":case"$":case"\\":case".":case"*":case"+":case"?":case"(":case")":case"[":case"|":throw Error("TBD");default:return{type:"Character",value:fe(e)}}}isRegExpFlag(){switch(this.peekChar(0)){case"g":case"i":case"m":case"u":case"y":return!0;default:return!1}}isRangeDash(){return this.peekChar()==="-"&&this.isClassAtom(1)}isDigit(){return Nf.test(this.peekChar(0))}isClassAtom(e=0){switch(this.peekChar(e)){case"]":case`
`:case"\r":case"\u2028":case"\u2029":return!1;default:return!0}}isTerm(){return this.isAtom()||this.isAssertion()}isAtom(){if(this.isPatternCharacter())return!0;switch(this.peekChar(0)){case".":case"\\":case"[":case"(":return!0;default:return!1}}isAssertion(){switch(this.peekChar(0)){case"^":case"$":return!0;case"\\":switch(this.peekChar(1)){case"b":case"B":return!0;default:return!1}case"(":return this.peekChar(1)==="?"&&(this.peekChar(2)==="="||this.peekChar(2)==="!");default:return!1}}isQuantifier(){let e=this.saveState();try{return this.quantifier(!0)!==void 0}catch{return!1}finally{this.restoreState(e)}}isPatternCharacter(){switch(this.peekChar()){case"^":case"$":case"\\":case".":case"*":case"+":case"?":case"(":case")":case"[":case"|":case"/":case`
`:case"\r":case"\u2028":case"\u2029":return!1;default:return!0}}parseHexDigits(e){let r="";for(let i=0;i<e;i++){let o=this.popChar();if(xw.test(o)===!1)throw Error("Expecting a HexDecimal digits");r+=o}return{type:"Character",value:parseInt(r,16)}}peekChar(e=0){return this.input[this.idx+e]}popChar(){let e=this.peekChar(0);return this.consumeChar(void 0),e}consumeChar(e){if(e!==void 0&&this.input[this.idx]!==e)throw Error("Expected: '"+e+"' but found: '"+this.input[this.idx]+"' at offset: "+this.idx);if(this.idx>=this.input.length)throw Error("Unexpected end of input");this.idx++}loc(e){return{begin:e,end:this.idx}}};var Fn=class{visitChildren(e){for(let r in e){let n=e[r];e.hasOwnProperty(r)&&(n.type!==void 0?this.visit(n):Array.isArray(n)&&n.forEach(i=>{this.visit(i)},this))}}visit(e){switch(e.type){case"Pattern":this.visitPattern(e);break;case"Flags":this.visitFlags(e);break;case"Disjunction":this.visitDisjunction(e);break;case"Alternative":this.visitAlternative(e);break;case"StartAnchor":this.visitStartAnchor(e);break;case"EndAnchor":this.visitEndAnchor(e);break;case"WordBoundary":this.visitWordBoundary(e);break;case"NonWordBoundary":this.visitNonWordBoundary(e);break;case"Lookahead":this.visitLookahead(e);break;case"NegativeLookahead":this.visitNegativeLookahead(e);break;case"Character":this.visitCharacter(e);break;case"Set":this.visitSet(e);break;case"Group":this.visitGroup(e);break;case"GroupBackReference":this.visitGroupBackReference(e);break;case"Quantifier":this.visitQuantifier(e);break}this.visitChildren(e)}visitPattern(e){}visitFlags(e){}visitDisjunction(e){}visitAlternative(e){}visitStartAnchor(e){}visitEndAnchor(e){}visitWordBoundary(e){}visitNonWordBoundary(e){}visitLookahead(e){}visitNegativeLookahead(e){}visitCharacter(e){}visitSet(e){}visitGroup(e){}visitGroupBackReference(e){}visitQuantifier(e){}};var uT=/\r?\n/gm,oE=new Lo,lT=class extends Fn{constructor(){super(...arguments),this.isStarting=!0,this.endRegexpStack=[],this.multiline=!1}get endRegex(){return this.endRegexpStack.join("")}reset(e){this.multiline=!1,this.regex=e,this.startRegexp="",this.isStarting=!0,this.endRegexpStack=[]}visitGroup(e){e.quantifier&&(this.isStarting=!1,this.endRegexpStack=[])}visitCharacter(e){let r=String.fromCharCode(e.value);if(!this.multiline&&r===`
`&&(this.multiline=!0),e.quantifier)this.isStarting=!1,this.endRegexpStack=[];else{let n=wo(r);this.endRegexpStack.push(n),this.isStarting&&(this.startRegexp+=n)}}visitSet(e){if(!this.multiline){let r=this.regex.substring(e.loc.begin,e.loc.end),n=new RegExp(r);this.multiline=!!`
`.match(n)}if(e.quantifier)this.isStarting=!1,this.endRegexpStack=[];else{let r=this.regex.substring(e.loc.begin,e.loc.end);this.endRegexpStack.push(r),this.isStarting&&(this.startRegexp+=r)}}visitChildren(e){e.type==="Group"&&e.quantifier||super.visitChildren(e)}},ko=new lT;function Ew(t){try{typeof t!="string"&&(t=t.source),t=`/${t}/`;let e=oE.pattern(t),r=[];for(let n of e.value.value)ko.reset(t),ko.visit(n),r.push({start:ko.startRegexp,end:ko.endRegex});return r}catch{return[]}}function cT(t){try{return typeof t=="string"&&(t=new RegExp(t)),t=t.toString(),ko.reset(t),ko.visit(oE.pattern(t)),ko.multiline}catch{return!1}}function Ef(t){return(typeof t=="string"?new RegExp(t):t).test(" ")}function wo(t){return t.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}function fT(t){return Array.prototype.map.call(t,e=>/\w/.test(e)?`[${e.toLowerCase()}${e.toUpperCase()}]`:wo(e)).join("")}function dT(t,e){let r=sE(t),n=e.match(r);return!!n&&n[0].length>0}function sE(t){typeof t=="string"&&(t=new RegExp(t));let e=t,r=t.source,n=0;function i(){let o="",s;function a(u){o+=r.substr(n,u),n+=u}function l(u){o+="(?:"+r.substr(n,u)+"|$)",n+=u}for(;n<r.length;)switch(r[n]){case"\\":switch(r[n+1]){case"c":l(3);break;case"x":l(4);break;case"u":e.unicode?r[n+2]==="{"?l(r.indexOf("}",n)-n+1):l(6):l(2);break;case"p":case"P":e.unicode?l(r.indexOf("}",n)-n+1):l(2);break;case"k":l(r.indexOf(">",n)-n+1);break;default:l(2);break}break;case"[":s=/\[(?:\\.|.)*?\]/g,s.lastIndex=n,s=s.exec(r)||[],l(s[0].length);break;case"|":case"^":case"$":case"*":case"+":case"?":a(1);break;case"{":s=/\{\d+,?\d*\}/g,s.lastIndex=n,s=s.exec(r),s?a(s[0].length):l(1);break;case"(":if(r[n+1]==="?")switch(r[n+2]){case":":o+="(?:",n+=3,o+=i()+"|$)";break;case"=":o+="(?=",n+=3,o+=i()+")";break;case"!":s=n,n+=3,i(),o+=r.substr(s,n-s);break;case"<":switch(r[n+3]){case"=":case"!":s=n,n+=4,i(),o+=r.substr(s,n-s);break;default:a(r.indexOf(">",n)-n+1),o+=i()+"|$)";break}break}else a(1),o+=i()+"|$)";break;case")":return++n,o;default:l(1);break}return o}return new RegExp(i(),t.flags)}function Cl(t){return t.rules.find(e=>Ct(e)&&e.entry)}function aE(t){return t.rules.filter(e=>Wr(e)&&e.hidden)}function bl(t,e){let r=new Set,n=Cl(t);if(!n)return new Set(t.rules);let i=[n].concat(aE(t));for(let s of i)lE(s,r,e);let o=new Set;for(let s of t.rules)(r.has(s.name)||Wr(s)&&s.hidden)&&o.add(s);return o}function lE(t,e,r){e.add(t.name),jr(t).forEach(n=>{if(Gr(n)||r&&Tf(n)){let i=n.rule.ref;i&&!e.has(i.name)&&lE(i,e,r)}})}function Ll(t){if(t.terminal)return t.terminal;if(t.type.ref){let e=Af(t.type.ref);return e==null?void 0:e.terminal}}function hT(t){return t.hidden&&!qi(t).test(" ")}function Hs(t,e){return!t||!e?[]:gT(t,e,t.astNode,!0)}function ji(t,e,r){if(!t||!e)return;let n=gT(t,e,t.astNode,!0);if(n.length!==0)return r!==void 0?r=Math.max(0,Math.min(r,n.length-1)):r=0,n[r]}function gT(t,e,r,n){if(!n){let i=tn(t.grammarSource,vr);if(i&&i.feature===e)return[t]}return Ar(t)&&t.astNode===r?t.content.flatMap(i=>gT(i,e,r,!1)):[]}function Of(t,e){return t?TT(t,e,t==null?void 0:t.astNode):[]}function Ks(t,e,r){if(!t)return;let n=TT(t,e,t==null?void 0:t.astNode);if(n.length!==0)return r!==void 0?r=Math.max(0,Math.min(r,n.length-1)):r=0,n[r]}function TT(t,e,r){if(t.astNode!==r)return[];if(ur(t.grammarSource)&&t.grammarSource.value===e)return[t];let n=Ao(t).iterator(),i,o=[];do if(i=n.next(),!i.done){let s=i.value;s.astNode===r?ur(s.grammarSource)&&s.grammarSource.value===e&&o.push(s):n.prune()}while(!i.done);return o}function yT(t){var e;let r=t.astNode;for(;r===((e=t.container)===null||e===void 0?void 0:e.astNode);){let n=tn(t.grammarSource,vr);if(n)return n;t=t.container}}function Af(t){let e=t;return mf(e)&&(In(e.$container)?e=e.$container.$container:Ct(e.$container)?e=e.$container:Gi(e.$container)),uE(t,e,new Map)}function uE(t,e,r){var n;function i(o,s){let a;return tn(o,vr)||(a=uE(s,s,r)),r.set(t,a),a}if(r.has(t))return r.get(t);r.set(t,void 0);for(let o of jr(e)){if(vr(o)&&o.feature.toLowerCase()==="name")return r.set(t,o),o;if(Gr(o)&&Ct(o.rule.ref))return i(o,o.rule.ref);if(gf(o)&&(!((n=o.typeRef)===null||n===void 0)&&n.ref))return i(o,o.typeRef.ref)}}function cE(t){let e=t.$container;if(fn(e)){let r=e.elements,n=r.indexOf(t);for(let i=n-1;i>=0;i--){let o=r[i];if(In(o))return o;{let s=jr(r[i]).find(In);if(s)return s}}}if(Oo(e))return cE(e)}function $o(t,e){return t==="?"||t==="*"||fn(e)&&!!e.guardCondition}function _T(t){return t==="*"||t==="+"}function Iw(t){return t==="+="}function kl(t){return fE(t,new Set)}function fE(t,e){if(e.has(t))return!0;e.add(t);for(let r of jr(t))if(Gr(r)){if(!r.rule.ref||Ct(r.rule.ref)&&!fE(r.rule.ref,e))return!1}else{if(vr(r))return!1;if(In(r))return!1}return!!t.definition}function Ow(t){return mT(t.type,new Set)}function mT(t,e){if(e.has(t))return!0;if(e.add(t),rg(t))return!1;if(vg(t))return!1;if(Og(t))return t.types.every(r=>mT(r,e));if(gf(t)){if(t.primitiveType!==void 0)return!0;if(t.stringType!==void 0)return!0;if(t.typeRef!==void 0){let r=t.typeRef.ref;return Nl(r)?mT(r.type,e):!1}else return!1}else return!1}function Po(t){if(t.inferredType)return t.inferredType.name;if(t.dataType)return t.dataType;if(t.returnType){let e=t.returnType.ref;if(e){if(Ct(e))return e.name;if(hf(e)||Nl(e))return e.name}}}function li(t){var e;if(Ct(t))return kl(t)?t.name:(e=Po(t))!==null&&e!==void 0?e:t.name;if(hf(t)||Nl(t)||Rg(t))return t.name;if(In(t)){let r=dE(t);if(r)return r}else if(mf(t))return t.name;throw new Error("Cannot get name of Unknown Type")}function dE(t){var e;if(t.inferredType)return t.inferredType.name;if(!((e=t.type)===null||e===void 0)&&e.ref)return li(t.type.ref)}function vT(t){var e,r,n;return Wr(t)?(r=(e=t.type)===null||e===void 0?void 0:e.name)!==null&&r!==void 0?r:"string":kl(t)?t.name:(n=Po(t))!==null&&n!==void 0?n:t.name}function qi(t){let e={s:!1,i:!1,u:!1},r=zs(t.definition,e),n=Object.entries(e).filter(([,i])=>i).map(([i])=>i).join("");return new RegExp(r,n)}var RT=/[\s\S]/.source;function zs(t,e){if(Gg(t))return Aw(t);if(qg(t))return Sw(t);if(bg(t))return bw(t);if(Tf(t)){let r=t.rule.ref;if(!r)throw new Error("Missing rule reference.");return ai(zs(r.definition),{cardinality:t.cardinality,lookahead:t.lookahead})}else{if(Fg(t))return Cw(t);if(Yg(t))return Dw(t);if(Vg(t)){let r=t.regex.lastIndexOf("/"),n=t.regex.substring(1,r),i=t.regex.substring(r+1);return e&&(e.i=i.includes("i"),e.s=i.includes("s"),e.u=i.includes("u")),ai(n,{cardinality:t.cardinality,lookahead:t.lookahead,wrap:!1})}else{if(Jg(t))return ai(RT,{cardinality:t.cardinality,lookahead:t.lookahead});throw new Error(`Invalid terminal element: ${t==null?void 0:t.$type}`)}}}function Aw(t){return ai(t.elements.map(e=>zs(e)).join("|"),{cardinality:t.cardinality,lookahead:t.lookahead})}function Sw(t){return ai(t.elements.map(e=>zs(e)).join(""),{cardinality:t.cardinality,lookahead:t.lookahead})}function Dw(t){return ai(`${RT}*?${zs(t.terminal)}`,{cardinality:t.cardinality,lookahead:t.lookahead})}function Cw(t){return ai(`(?!${zs(t.terminal)})${RT}*?`,{cardinality:t.cardinality,lookahead:t.lookahead})}function bw(t){return t.right?ai(`[${pT(t.left)}-${pT(t.right)}]`,{cardinality:t.cardinality,lookahead:t.lookahead,wrap:!1}):ai(pT(t.left),{cardinality:t.cardinality,lookahead:t.lookahead,wrap:!1})}function pT(t){return wo(t.value)}function ai(t,e){var r;return(e.wrap!==!1||e.lookahead)&&(t=`(${(r=e.lookahead)!==null&&r!==void 0?r:""}${t})`),e.cardinality?`${t}${e.cardinality}`:t}function wl(t,e){let r={stacks:t,tokens:e};return Lw(r),r.stacks.flat().forEach(i=>{i.property=void 0}),mE(r.stacks).map(i=>i[i.length-1])}function xT(t){let{next:e,cardinalities:r,visited:n,plus:i}=t,o=[],s=e.feature;if(n.has(s))return[];n.add(s);let a,l=s;for(;l.$container;)if(fn(l.$container)){a=l.$container;break}else if(Oo(l.$container))l=l.$container;else break;if(_T(l.cardinality)){let u=Ys({next:{feature:l,type:e.type},cardinalities:r,visited:n,plus:i});for(let c of u)i.add(c.feature);o.push(...u)}if(a){let u=a.elements.indexOf(l);u!==void 0&&u<a.elements.length-1&&o.push(...pE({feature:a,type:e.type},u+1,r,n,i)),o.every(c=>$o(c.feature.cardinality,c.feature)||$o(r.get(c.feature))||i.has(c.feature))&&o.push(...xT({next:{feature:a,type:e.type},cardinalities:r,visited:n,plus:i}))}return o}function Mo(t){return Be(t)&&(t={feature:t}),Ys({next:t,cardinalities:new Map,visited:new Set,plus:new Set})}function Ys(t){var e,r,n;let{next:i,cardinalities:o,visited:s,plus:a}=t;if(i===void 0)return[];let{feature:l,type:u}=i;if(fn(l)){if(s.has(l))return[];s.add(l)}if(fn(l))return pE(i,0,o,s,a).map(c=>Sf(c,l.cardinality,o));if(Vs(l)||Bs(l))return l.elements.flatMap(c=>Ys({next:{feature:c,type:u,property:i.property},cardinalities:o,visited:s,plus:a})).map(c=>Sf(c,l.cardinality,o));if(vr(l)){let c={feature:l.terminal,type:u,property:(e=i.property)!==null&&e!==void 0?e:l.feature};return Ys({next:c,cardinalities:o,visited:s,plus:a}).map(f=>Sf(f,l.cardinality,o))}else{if(In(l))return xT({next:{feature:l,type:li(l),property:(r=i.property)!==null&&r!==void 0?r:l.feature},cardinalities:o,visited:s,plus:a});if(Gr(l)&&Ct(l.rule.ref)){let c=l.rule.ref,f={feature:c.definition,type:c.fragment||c.dataType?void 0:(n=Po(c))!==null&&n!==void 0?n:c.name,property:i.property};return Ys({next:f,cardinalities:o,visited:s,plus:a}).map(d=>Sf(d,l.cardinality,o))}else return[i]}}function Sf(t,e,r){return r.set(t.feature,e),t}function pE(t,e,r,n,i){var o;let s=[],a;for(;e<t.feature.elements.length&&(a={feature:t.feature.elements[e++],type:t.type},s.push(...Ys({next:a,cardinalities:r,visited:n,plus:i})),!!$o((o=a.feature.cardinality)!==null&&o!==void 0?o:r.get(a.feature),a.feature)););return s}function Lw(t){for(let e of t.tokens){let r=mE(t.stacks,e);t.stacks=r}}function mE(t,e){let r=[];for(let n of t)r.push(...kw(n,e));return r}function kw(t,e){let r=new Map,n=new Set(t.map(o=>o.feature).filter(ww)),i=[];for(;t.length>0;){let o=t.pop(),s=xT({next:o,cardinalities:r,plus:n,visited:new Set}).filter(a=>e?NT(a.feature,e):!0);for(let a of s)i.push([...t,a]);if(!s.every(a=>$o(a.feature.cardinality,a.feature)||$o(r.get(a.feature))))break}return i}function ww(t){if(t.cardinality==="+")return!0;let e=tn(t,vr);return!!(e&&e.cardinality==="+")}function NT(t,e){if(ur(t))return t.value===e.image;if(Gr(t))return $w(t.rule.ref,e);if(On(t)){let r=Ll(t);if(r)return NT(r,e)}return!1}function $w(t,e){return Ct(t)?Mo(t.definition).some(n=>NT(n.feature,e)):Wr(t)?qi(t).test(e.image):!1}function hE(t){let e=Array.from(new Set(t.flatMap(n=>{var i;return(i=n==null?void 0:n.triggerCharacters)!==null&&i!==void 0?i:[]}))),r=Array.from(new Set(t.flatMap(n=>{var i;return(i=n==null?void 0:n.allCommitCharacters)!==null&&i!==void 0?i:[]})));return{triggerCharacters:e.length>0?e:void 0,allCommitCharacters:r.length>0?r:void 0}}var Xs=class{constructor(e){this.scopeProvider=e.references.ScopeProvider,this.grammar=e.Grammar,this.completionParser=e.parser.CompletionParser,this.nameProvider=e.references.NameProvider,this.lexer=e.parser.Lexer,this.nodeKindProvider=e.shared.lsp.NodeKindProvider,this.fuzzyMatcher=e.shared.lsp.FuzzyMatcher,this.grammarConfig=e.parser.GrammarConfig,this.astReflection=e.shared.AstReflection}async getCompletion(e,r){let n=[],i=this.buildContexts(e,r.position),o=(l,u)=>{let c=this.fillCompletionItem(l,u);c&&n.push(c)},s=l=>ur(l.feature)?l.feature.value:l.feature,a=[];for(let l of i)if(await Promise.all(pe(l.features).distinct(s).exclude(a).map(u=>this.completionFor(l,u,o))),a.push(...l.features),!this.continueCompletion(n))break;return Js.CompletionList.create(this.deduplicateItems(n),!0)}deduplicateItems(e){return pe(e).distinct(r=>`${r.kind}_${r.label}_${r.detail}`).toArray()}findFeaturesAt(e,r){let n=e.getText({start:Js.Position.create(0,0),end:e.positionAt(r)}),i=this.completionParser.parse(n),o=i.tokens;if(i.tokenIndex===0){let l=Cl(this.grammar),u=Mo({feature:l.definition,type:Po(l)});return o.length>0?(o.shift(),wl(u.map(c=>[c]),o)):u}let s=[...o].splice(i.tokenIndex);return wl([i.elementStack.map(l=>({feature:l}))],s)}*buildContexts(e,r){var n,i;let o=e.parseResult.value.$cstNode;if(!o)return;let s=e.textDocument,a=s.getText(),l=s.offsetAt(r),u={document:e,textDocument:s,offset:l,position:r},c=this.findDataTypeRuleStart(o,l);if(c){let[y,g]=c,O=(n=Il(o,y))===null||n===void 0?void 0:n.astNode;yield Object.assign(Object.assign({},u),{node:O,tokenOffset:y,tokenEndOffset:g,features:this.findFeaturesAt(s,y)})}let{nextTokenStart:f,nextTokenEnd:d,previousTokenStart:m,previousTokenEnd:_}=this.backtrackToAnyToken(a,l),x=f;l<=f&&m!==void 0&&(x=m);let A=(i=Il(o,x))===null||i===void 0?void 0:i.astNode,I=!0;if(m!==void 0&&_!==void 0&&_===l&&(yield Object.assign(Object.assign({},u),{node:A,tokenOffset:m,tokenEndOffset:_,features:this.findFeaturesAt(s,m)}),I=this.performNextTokenCompletion(e,a.substring(m,_),m,_),I&&(yield Object.assign(Object.assign({},u),{node:A,tokenOffset:_,tokenEndOffset:_,features:this.findFeaturesAt(s,_)}))),A)I&&(yield Object.assign(Object.assign({},u),{node:A,tokenOffset:f,tokenEndOffset:d,features:this.findFeaturesAt(s,f)}));else{let y=Cl(this.grammar);if(!y)throw new Error("Missing entry parser rule");yield Object.assign(Object.assign({},u),{tokenOffset:f,tokenEndOffset:d,features:Mo(y.definition)})}}performNextTokenCompletion(e,r,n,i){return/\P{L}$/u.test(r)}findDataTypeRuleStart(e,r){var n,i;let o=rr(e,r,this.grammarConfig.nameRegexp),s=!!(!((n=tn(o==null?void 0:o.grammarSource,Ct))===null||n===void 0)&&n.dataType);if(s){for(;s;)o=o==null?void 0:o.container,s=!!(!((i=tn(o==null?void 0:o.grammarSource,Ct))===null||i===void 0)&&i.dataType);if(o)return[o.offset,o.end]}}continueCompletion(e){return e.length===0}backtrackToAnyToken(e,r){let n=this.lexer.tokenize(e).tokens;if(n.length===0)return{nextTokenStart:r,nextTokenEnd:r};let i;for(let o of n){if(o.startOffset>=r)return{nextTokenStart:r,nextTokenEnd:r,previousTokenStart:i?i.startOffset:void 0,previousTokenEnd:i?i.endOffset+1:void 0};if(o.endOffset>=r)return{nextTokenStart:o.startOffset,nextTokenEnd:o.endOffset+1,previousTokenStart:i?i.startOffset:void 0,previousTokenEnd:i?i.endOffset+1:void 0};i=o}return{nextTokenStart:r,nextTokenEnd:r,previousTokenStart:i?i.startOffset:void 0,previousTokenEnd:i?i.endOffset+1:void 0}}completionFor(e,r,n){if(ur(r.feature))return this.completionForKeyword(e,r.feature,n);if(On(r.feature)&&e.node)return this.completionForCrossReference(e,r,n)}completionForCrossReference(e,r,n){let i=tn(r.feature,vr),o=e.node;if(i&&o){r.type&&(o={$type:r.type,$container:o,$containerProperty:r.property},Ol(this.astReflection,o));let s={reference:{$refText:""},container:o,property:i.feature};try{this.getReferenceCandidates(s,e).forEach(a=>n(e,this.createReferenceCompletionItem(a)))}catch(a){console.error(a)}}}getReferenceCandidates(e,r){return this.scopeProvider.getScope(e).getAllElements()}createReferenceCompletionItem(e){return{nodeDescription:e,kind:this.nodeKindProvider.getCompletionItemKind(e),detail:e.type,sortText:"0"}}completionForKeyword(e,r,n){this.filterKeyword(e,r)&&n(e,{label:r.value,kind:Js.CompletionItemKind.Keyword,detail:"Keyword",sortText:"1"})}filterKeyword(e,r){return/\p{L}/u.test(r.value)}fillCompletionItem(e,r){var n,i;let o;if(typeof r.label=="string")o=r.label;else if("node"in r){let u=this.nameProvider.getName(r.node);if(!u)return;o=u}else if("nodeDescription"in r)o=r.nodeDescription.name;else return;let s;typeof((n=r.textEdit)===null||n===void 0?void 0:n.newText)=="string"?s=r.textEdit.newText:typeof r.insertText=="string"?s=r.insertText:s=o;let a=(i=r.textEdit)!==null&&i!==void 0?i:this.buildCompletionTextEdit(e,o,s);return a?{additionalTextEdits:r.additionalTextEdits,command:r.command,commitCharacters:r.commitCharacters,data:r.data,detail:r.detail,documentation:r.documentation,filterText:r.filterText,insertText:r.insertText,insertTextFormat:r.insertTextFormat,insertTextMode:r.insertTextMode,kind:r.kind,labelDetails:r.labelDetails,preselect:r.preselect,sortText:r.sortText,tags:r.tags,textEditText:r.textEditText,textEdit:a,label:o}:void 0}buildCompletionTextEdit(e,r,n){let o=e.textDocument.getText().substring(e.tokenOffset,e.offset);if(this.fuzzyMatcher.match(o,r)){let s=e.textDocument.positionAt(e.tokenOffset),a=e.position;return{newText:n,range:{start:s,end:a}}}else return}};var Pw=yt(Or(),1);var gE;(()=>{"use strict";var t={470:i=>{function o(l){if(typeof l!="string")throw new TypeError("Path must be a string. Received "+JSON.stringify(l))}function s(l,u){for(var c,f="",d=0,m=-1,_=0,x=0;x<=l.length;++x){if(x<l.length)c=l.charCodeAt(x);else{if(c===47)break;c=47}if(c===47){if(!(m===x-1||_===1))if(m!==x-1&&_===2){if(f.length<2||d!==2||f.charCodeAt(f.length-1)!==46||f.charCodeAt(f.length-2)!==46){if(f.length>2){var A=f.lastIndexOf("/");if(A!==f.length-1){A===-1?(f="",d=0):d=(f=f.slice(0,A)).length-1-f.lastIndexOf("/"),m=x,_=0;continue}}else if(f.length===2||f.length===1){f="",d=0,m=x,_=0;continue}}u&&(f.length>0?f+="/..":f="..",d=2)}else f.length>0?f+="/"+l.slice(m+1,x):f=l.slice(m+1,x),d=x-m-1;m=x,_=0}else c===46&&_!==-1?++_:_=-1}return f}var a={resolve:function(){for(var l,u="",c=!1,f=arguments.length-1;f>=-1&&!c;f--){var d;f>=0?d=arguments[f]:(l===void 0&&(l=process.cwd()),d=l),o(d),d.length!==0&&(u=d+"/"+u,c=d.charCodeAt(0)===47)}return u=s(u,!c),c?u.length>0?"/"+u:"/":u.length>0?u:"."},normalize:function(l){if(o(l),l.length===0)return".";var u=l.charCodeAt(0)===47,c=l.charCodeAt(l.length-1)===47;return(l=s(l,!u)).length!==0||u||(l="."),l.length>0&&c&&(l+="/"),u?"/"+l:l},isAbsolute:function(l){return o(l),l.length>0&&l.charCodeAt(0)===47},join:function(){if(arguments.length===0)return".";for(var l,u=0;u<arguments.length;++u){var c=arguments[u];o(c),c.length>0&&(l===void 0?l=c:l+="/"+c)}return l===void 0?".":a.normalize(l)},relative:function(l,u){if(o(l),o(u),l===u||(l=a.resolve(l))===(u=a.resolve(u)))return"";for(var c=1;c<l.length&&l.charCodeAt(c)===47;++c);for(var f=l.length,d=f-c,m=1;m<u.length&&u.charCodeAt(m)===47;++m);for(var _=u.length-m,x=d<_?d:_,A=-1,I=0;I<=x;++I){if(I===x){if(_>x){if(u.charCodeAt(m+I)===47)return u.slice(m+I+1);if(I===0)return u.slice(m+I)}else d>x&&(l.charCodeAt(c+I)===47?A=I:I===0&&(A=0));break}var y=l.charCodeAt(c+I);if(y!==u.charCodeAt(m+I))break;y===47&&(A=I)}var g="";for(I=c+A+1;I<=f;++I)I!==f&&l.charCodeAt(I)!==47||(g.length===0?g+="..":g+="/..");return g.length>0?g+u.slice(m+A):(m+=A,u.charCodeAt(m)===47&&++m,u.slice(m))},_makeLong:function(l){return l},dirname:function(l){if(o(l),l.length===0)return".";for(var u=l.charCodeAt(0),c=u===47,f=-1,d=!0,m=l.length-1;m>=1;--m)if((u=l.charCodeAt(m))===47){if(!d){f=m;break}}else d=!1;return f===-1?c?"/":".":c&&f===1?"//":l.slice(0,f)},basename:function(l,u){if(u!==void 0&&typeof u!="string")throw new TypeError('"ext" argument must be a string');o(l);var c,f=0,d=-1,m=!0;if(u!==void 0&&u.length>0&&u.length<=l.length){if(u.length===l.length&&u===l)return"";var _=u.length-1,x=-1;for(c=l.length-1;c>=0;--c){var A=l.charCodeAt(c);if(A===47){if(!m){f=c+1;break}}else x===-1&&(m=!1,x=c+1),_>=0&&(A===u.charCodeAt(_)?--_==-1&&(d=c):(_=-1,d=x))}return f===d?d=x:d===-1&&(d=l.length),l.slice(f,d)}for(c=l.length-1;c>=0;--c)if(l.charCodeAt(c)===47){if(!m){f=c+1;break}}else d===-1&&(m=!1,d=c+1);return d===-1?"":l.slice(f,d)},extname:function(l){o(l);for(var u=-1,c=0,f=-1,d=!0,m=0,_=l.length-1;_>=0;--_){var x=l.charCodeAt(_);if(x!==47)f===-1&&(d=!1,f=_+1),x===46?u===-1?u=_:m!==1&&(m=1):u!==-1&&(m=-1);else if(!d){c=_+1;break}}return u===-1||f===-1||m===0||m===1&&u===f-1&&u===c+1?"":l.slice(u,f)},format:function(l){if(l===null||typeof l!="object")throw new TypeError('The "pathObject" argument must be of type Object. Received type '+typeof l);return function(u,c){var f=c.dir||c.root,d=c.base||(c.name||"")+(c.ext||"");return f?f===c.root?f+d:f+"/"+d:d}(0,l)},parse:function(l){o(l);var u={root:"",dir:"",base:"",ext:"",name:""};if(l.length===0)return u;var c,f=l.charCodeAt(0),d=f===47;d?(u.root="/",c=1):c=0;for(var m=-1,_=0,x=-1,A=!0,I=l.length-1,y=0;I>=c;--I)if((f=l.charCodeAt(I))!==47)x===-1&&(A=!1,x=I+1),f===46?m===-1?m=I:y!==1&&(y=1):m!==-1&&(y=-1);else if(!A){_=I+1;break}return m===-1||x===-1||y===0||y===1&&m===x-1&&m===_+1?x!==-1&&(u.base=u.name=_===0&&d?l.slice(1,x):l.slice(_,x)):(_===0&&d?(u.name=l.slice(1,m),u.base=l.slice(1,x)):(u.name=l.slice(_,m),u.base=l.slice(_,x)),u.ext=l.slice(m,x)),_>0?u.dir=l.slice(0,_-1):d&&(u.dir="/"),u},sep:"/",delimiter:":",win32:null,posix:null};a.posix=a,i.exports=a}},e={};function r(i){var o=e[i];if(o!==void 0)return o.exports;var s=e[i]={exports:{}};return t[i](s,s.exports,r),s.exports}r.d=(i,o)=>{for(var s in o)r.o(o,s)&&!r.o(i,s)&&Object.defineProperty(i,s,{enumerable:!0,get:o[s]})},r.o=(i,o)=>Object.prototype.hasOwnProperty.call(i,o),r.r=i=>{typeof Symbol!="undefined"&&Symbol.toStringTag&&Object.defineProperty(i,Symbol.toStringTag,{value:"Module"}),Object.defineProperty(i,"__esModule",{value:!0})};var n={};(()=>{let i;r.r(n),r.d(n,{URI:()=>d,Utils:()=>Ce}),typeof process=="object"?i=process.platform==="win32":typeof navigator=="object"&&(i=navigator.userAgent.indexOf("Windows")>=0);let o=/^\w[\w\d+.-]*$/,s=/^\//,a=/^\/\//;function l(j,k){if(!j.scheme&&k)throw new Error(`[UriError]: Scheme is missing: {scheme: "", authority: "${j.authority}", path: "${j.path}", query: "${j.query}", fragment: "${j.fragment}"}`);if(j.scheme&&!o.test(j.scheme))throw new Error("[UriError]: Scheme contains illegal characters.");if(j.path){if(j.authority){if(!s.test(j.path))throw new Error('[UriError]: If a URI contains an authority component, then the path component must either be empty or begin with a slash ("/") character')}else if(a.test(j.path))throw new Error('[UriError]: If a URI does not contain an authority component, then the path cannot begin with two slash characters ("//")')}}let u="",c="/",f=/^(([^:/?#]+?):)?(\/\/([^/?#]*))?([^?#]*)(\?([^#]*))?(#(.*))?/;class d{constructor(k,V,G,ie,z,$=!1){Si(this,"scheme");Si(this,"authority");Si(this,"path");Si(this,"query");Si(this,"fragment");typeof k=="object"?(this.scheme=k.scheme||u,this.authority=k.authority||u,this.path=k.path||u,this.query=k.query||u,this.fragment=k.fragment||u):(this.scheme=function(w,le){return w||le?w:"file"}(k,$),this.authority=V||u,this.path=function(w,le){switch(w){case"https":case"http":case"file":le?le[0]!==c&&(le=c+le):le=c}return le}(this.scheme,G||u),this.query=ie||u,this.fragment=z||u,l(this,$))}static isUri(k){return k instanceof d||!!k&&typeof k.authority=="string"&&typeof k.fragment=="string"&&typeof k.path=="string"&&typeof k.query=="string"&&typeof k.scheme=="string"&&typeof k.fsPath=="string"&&typeof k.with=="function"&&typeof k.toString=="function"}get fsPath(){return y(this,!1)}with(k){if(!k)return this;let{scheme:V,authority:G,path:ie,query:z,fragment:$}=k;return V===void 0?V=this.scheme:V===null&&(V=u),G===void 0?G=this.authority:G===null&&(G=u),ie===void 0?ie=this.path:ie===null&&(ie=u),z===void 0?z=this.query:z===null&&(z=u),$===void 0?$=this.fragment:$===null&&($=u),V===this.scheme&&G===this.authority&&ie===this.path&&z===this.query&&$===this.fragment?this:new _(V,G,ie,z,$)}static parse(k,V=!1){let G=f.exec(k);return G?new _(G[2]||u,J(G[4]||u),J(G[5]||u),J(G[7]||u),J(G[9]||u),V):new _(u,u,u,u,u)}static file(k){let V=u;if(i&&(k=k.replace(/\\/g,c)),k[0]===c&&k[1]===c){let G=k.indexOf(c,2);G===-1?(V=k.substring(2),k=c):(V=k.substring(2,G),k=k.substring(G)||c)}return new _("file",V,k,u,u)}static from(k){let V=new _(k.scheme,k.authority,k.path,k.query,k.fragment);return l(V,!0),V}toString(k=!1){return g(this,k)}toJSON(){return this}static revive(k){if(k){if(k instanceof d)return k;{let V=new _(k);return V._formatted=k.external,V._fsPath=k._sep===m?k.fsPath:null,V}}return k}}let m=i?1:void 0;class _ extends d{constructor(){super(...arguments);Si(this,"_formatted",null);Si(this,"_fsPath",null)}get fsPath(){return this._fsPath||(this._fsPath=y(this,!1)),this._fsPath}toString(V=!1){return V?g(this,!0):(this._formatted||(this._formatted=g(this,!1)),this._formatted)}toJSON(){let V={$mid:1};return this._fsPath&&(V.fsPath=this._fsPath,V._sep=m),this._formatted&&(V.external=this._formatted),this.path&&(V.path=this.path),this.scheme&&(V.scheme=this.scheme),this.authority&&(V.authority=this.authority),this.query&&(V.query=this.query),this.fragment&&(V.fragment=this.fragment),V}}let x={58:"%3A",47:"%2F",63:"%3F",35:"%23",91:"%5B",93:"%5D",64:"%40",33:"%21",36:"%24",38:"%26",39:"%27",40:"%28",41:"%29",42:"%2A",43:"%2B",44:"%2C",59:"%3B",61:"%3D",32:"%20"};function A(j,k,V){let G,ie=-1;for(let z=0;z<j.length;z++){let $=j.charCodeAt(z);if($>=97&&$<=122||$>=65&&$<=90||$>=48&&$<=57||$===45||$===46||$===95||$===126||k&&$===47||V&&$===91||V&&$===93||V&&$===58)ie!==-1&&(G+=encodeURIComponent(j.substring(ie,z)),ie=-1),G!==void 0&&(G+=j.charAt(z));else{G===void 0&&(G=j.substr(0,z));let w=x[$];w!==void 0?(ie!==-1&&(G+=encodeURIComponent(j.substring(ie,z)),ie=-1),G+=w):ie===-1&&(ie=z)}}return ie!==-1&&(G+=encodeURIComponent(j.substring(ie))),G!==void 0?G:j}function I(j){let k;for(let V=0;V<j.length;V++){let G=j.charCodeAt(V);G===35||G===63?(k===void 0&&(k=j.substr(0,V)),k+=x[G]):k!==void 0&&(k+=j[V])}return k!==void 0?k:j}function y(j,k){let V;return V=j.authority&&j.path.length>1&&j.scheme==="file"?`//${j.authority}${j.path}`:j.path.charCodeAt(0)===47&&(j.path.charCodeAt(1)>=65&&j.path.charCodeAt(1)<=90||j.path.charCodeAt(1)>=97&&j.path.charCodeAt(1)<=122)&&j.path.charCodeAt(2)===58?k?j.path.substr(1):j.path[1].toLowerCase()+j.path.substr(2):j.path,i&&(V=V.replace(/\//g,"\\")),V}function g(j,k){let V=k?I:A,G="",{scheme:ie,authority:z,path:$,query:w,fragment:le}=j;if(ie&&(G+=ie,G+=":"),(z||ie==="file")&&(G+=c,G+=c),z){let he=z.indexOf("@");if(he!==-1){let Se=z.substr(0,he);z=z.substr(he+1),he=Se.lastIndexOf(":"),he===-1?G+=V(Se,!1,!1):(G+=V(Se.substr(0,he),!1,!1),G+=":",G+=V(Se.substr(he+1),!1,!0)),G+="@"}z=z.toLowerCase(),he=z.lastIndexOf(":"),he===-1?G+=V(z,!1,!0):(G+=V(z.substr(0,he),!1,!0),G+=z.substr(he))}if($){if($.length>=3&&$.charCodeAt(0)===47&&$.charCodeAt(2)===58){let he=$.charCodeAt(1);he>=65&&he<=90&&($=`/${String.fromCharCode(he+32)}:${$.substr(3)}`)}else if($.length>=2&&$.charCodeAt(1)===58){let he=$.charCodeAt(0);he>=65&&he<=90&&($=`${String.fromCharCode(he+32)}:${$.substr(2)}`)}G+=V($,!0,!1)}return w&&(G+="?",G+=V(w,!1,!1)),le&&(G+="#",G+=k?le:A(le,!1,!1)),G}function O(j){try{return decodeURIComponent(j)}catch{return j.length>3?j.substr(0,3)+O(j.substr(3)):j}}let M=/(%[0-9A-Za-z][0-9A-Za-z])+/g;function J(j){return j.match(M)?j.replace(M,k=>O(k)):j}var ce=r(470);let _e=ce.posix||ce,je="/";var Ce;(function(j){j.joinPath=function(k,...V){return k.with({path:_e.join(k.path,...V)})},j.resolvePath=function(k,...V){let G=k.path,ie=!1;G[0]!==je&&(G=je+G,ie=!0);let z=_e.resolve(G,...V);return ie&&z[0]===je&&!k.authority&&(z=z.substring(1)),k.with({path:z})},j.dirname=function(k){if(k.path.length===0||k.path===je)return k;let V=_e.dirname(k.path);return V.length===1&&V.charCodeAt(0)===46&&(V=""),k.with({path:V})},j.basename=function(k){return _e.basename(k.path)},j.extname=function(k){return _e.extname(k.path)}})(Ce||(Ce={}))})(),gE=n})();var{URI:Pe,Utils:Qs}=gE;var Vt;(function(t){t.basename=Qs.basename,t.dirname=Qs.dirname,t.extname=Qs.extname,t.joinPath=Qs.joinPath,t.resolvePath=Qs.resolvePath;function e(n,i){return(n==null?void 0:n.toString())===(i==null?void 0:i.toString())}t.equals=e;function r(n,i){let o=typeof n=="string"?n:n.path,s=typeof i=="string"?i:i.path,a=o.split("/").filter(d=>d.length>0),l=s.split("/").filter(d=>d.length>0),u=0;for(;u<a.length&&a[u]===l[u];u++);let c="../".repeat(a.length-u),f=l.slice(u).join("/");return c+f}t.relative=r})(Vt||(Vt={}));var TE=yt(Or(),1);var Df=class{constructor(e){this.nameProvider=e.references.NameProvider,this.references=e.references.References,this.grammarConfig=e.parser.GrammarConfig}getDefinition(e,r){let n=e.parseResult.value;if(n.$cstNode){let i=n.$cstNode,o=rr(i,e.textDocument.offsetAt(r.position),this.grammarConfig.nameRegexp);if(o)return this.collectLocationLinks(o,r)}}collectLocationLinks(e,r){var n;let i=this.findLink(e);if(i)return[TE.LocationLink.create(i.targetDocument.textDocument.uri,((n=i.target.astNode.$cstNode)!==null&&n!==void 0?n:i.target).range,i.target.range,i.source.range)]}findLink(e){let r=this.references.findDeclarationNode(e);if(r!=null&&r.astNode){let n=xt(r.astNode);if(r&&n)return{source:e,target:r,targetDocument:n}}}};var _C=yt(Or(),1);function ET(t){let e=[],r=t.Grammar;for(let n of r.rules)Wr(n)&&hT(n)&&cT(qi(n))&&e.push(n.name);return{multilineCommentRules:e,nameRegexp:vf}}var Mw=typeof global=="object"&&global&&global.Object===Object&&global,Cf=Mw;var Fw=typeof self=="object"&&self&&self.Object===Object&&self,Uw=Cf||Fw||Function("return this")(),Ht=Uw;var Vw=Ht.Symbol,nr=Vw;var yE=Object.prototype,Bw=yE.hasOwnProperty,Ww=yE.toString,$l=nr?nr.toStringTag:void 0;function Gw(t){var e=Bw.call(t,$l),r=t[$l];try{t[$l]=void 0;var n=!0}catch{}var i=Ww.call(t);return n&&(e?t[$l]=r:delete t[$l]),i}var _E=Gw;var jw=Object.prototype,qw=jw.toString;function Hw(t){return qw.call(t)}var vE=Hw;var Kw="[object Null]",zw="[object Undefined]",RE=nr?nr.toStringTag:void 0;function Yw(t){return t==null?t===void 0?zw:Kw:RE&&RE in Object(t)?_E(t):vE(t)}var Dr=Yw;function Xw(t){return t!=null&&typeof t=="object"}var Bt=Xw;var Jw="[object Symbol]";function Qw(t){return typeof t=="symbol"||Bt(t)&&Dr(t)==Jw}var Un=Qw;function Zw(t,e){for(var r=-1,n=t==null?0:t.length,i=Array(n);++r<n;)i[r]=e(t[r],r,t);return i}var Vn=Zw;var e$=Array.isArray,se=e$;var t$=1/0,xE=nr?nr.prototype:void 0,NE=xE?xE.toString:void 0;function EE(t){if(typeof t=="string")return t;if(se(t))return Vn(t,EE)+"";if(Un(t))return NE?NE.call(t):"";var e=t+"";return e=="0"&&1/t==-t$?"-0":e}var IE=EE;var r$=/\s/;function n$(t){for(var e=t.length;e--&&r$.test(t.charAt(e)););return e}var OE=n$;var i$=/^\s+/;function o$(t){return t&&t.slice(0,OE(t)+1).replace(i$,"")}var AE=o$;function s$(t){var e=typeof t;return t!=null&&(e=="object"||e=="function")}var Nt=s$;var SE=NaN,a$=/^[-+]0x[0-9a-f]+$/i,l$=/^0b[01]+$/i,u$=/^0o[0-7]+$/i,c$=parseInt;function f$(t){if(typeof t=="number")return t;if(Un(t))return SE;if(Nt(t)){var e=typeof t.valueOf=="function"?t.valueOf():t;t=Nt(e)?e+"":e}if(typeof t!="string")return t===0?t:+t;t=AE(t);var r=l$.test(t);return r||u$.test(t)?c$(t.slice(2),r?2:8):a$.test(t)?SE:+t}var DE=f$;var CE=1/0,d$=17976931348623157e292;function p$(t){if(!t)return t===0?t:0;if(t=DE(t),t===CE||t===-CE){var e=t<0?-1:1;return e*d$}return t===t?t:0}var bE=p$;function m$(t){var e=bE(t),r=e%1;return e===e?r?e-r:e:0}var Bn=m$;function h$(t){return t}var Hr=h$;var g$="[object AsyncFunction]",T$="[object Function]",y$="[object GeneratorFunction]",_$="[object Proxy]";function v$(t){if(!Nt(t))return!1;var e=Dr(t);return e==T$||e==y$||e==g$||e==_$}var Cr=v$;var R$=Ht["__core-js_shared__"],bf=R$;var LE=function(){var t=/[^.]+$/.exec(bf&&bf.keys&&bf.keys.IE_PROTO||"");return t?"Symbol(src)_1."+t:""}();function x$(t){return!!LE&&LE in t}var kE=x$;var N$=Function.prototype,E$=N$.toString;function I$(t){if(t!=null){try{return E$.call(t)}catch{}try{return t+""}catch{}}return""}var ui=I$;var O$=/[\\^$.*+?()[\]{}|]/g,A$=/^\[object .+?Constructor\]$/,S$=Function.prototype,D$=Object.prototype,C$=S$.toString,b$=D$.hasOwnProperty,L$=RegExp("^"+C$.call(b$).replace(O$,"\\$&").replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g,"$1.*?")+"$");function k$(t){if(!Nt(t)||kE(t))return!1;var e=Cr(t)?L$:A$;return e.test(ui(t))}var wE=k$;function w$(t,e){return t==null?void 0:t[e]}var $E=w$;function $$(t,e){var r=$E(t,e);return wE(r)?r:void 0}var Kr=$$;var P$=Kr(Ht,"WeakMap"),Lf=P$;var PE=Object.create,M$=function(){function t(){}return function(e){if(!Nt(e))return{};if(PE)return PE(e);t.prototype=e;var r=new t;return t.prototype=void 0,r}}(),ME=M$;function F$(t,e,r){switch(r.length){case 0:return t.call(e);case 1:return t.call(e,r[0]);case 2:return t.call(e,r[0],r[1]);case 3:return t.call(e,r[0],r[1],r[2])}return t.apply(e,r)}var FE=F$;function U$(){}var Et=U$;function V$(t,e){var r=-1,n=t.length;for(e||(e=Array(n));++r<n;)e[r]=t[r];return e}var UE=V$;var B$=800,W$=16,G$=Date.now;function j$(t){var e=0,r=0;return function(){var n=G$(),i=W$-(n-r);if(r=n,i>0){if(++e>=B$)return arguments[0]}else e=0;return t.apply(void 0,arguments)}}var VE=j$;function q$(t){return function(){return t}}var BE=q$;var H$=function(){try{var t=Kr(Object,"defineProperty");return t({},"",{}),t}catch{}}(),Zs=H$;var K$=Zs?function(t,e){return Zs(t,"toString",{configurable:!0,enumerable:!1,value:BE(e),writable:!0})}:Hr,WE=K$;var z$=VE(WE),GE=z$;function Y$(t,e){for(var r=-1,n=t==null?0:t.length;++r<n&&e(t[r],r,t)!==!1;);return t}var kf=Y$;function X$(t,e,r,n){for(var i=t.length,o=r+(n?1:-1);n?o--:++o<i;)if(e(t[o],o,t))return o;return-1}var wf=X$;function J$(t){return t!==t}var jE=J$;function Q$(t,e,r){for(var n=r-1,i=t.length;++n<i;)if(t[n]===e)return n;return-1}var qE=Q$;function Z$(t,e,r){return e===e?qE(t,e,r):wf(t,jE,r)}var ea=Z$;function eP(t,e){var r=t==null?0:t.length;return!!r&&ea(t,e,0)>-1}var $f=eP;var tP=9007199254740991,rP=/^(?:0|[1-9]\d*)$/;function nP(t,e){var r=typeof t;return e=e==null?tP:e,!!e&&(r=="number"||r!="symbol"&&rP.test(t))&&t>-1&&t%1==0&&t<e}var Hi=nP;function iP(t,e,r){e=="__proto__"&&Zs?Zs(t,e,{configurable:!0,enumerable:!0,value:r,writable:!0}):t[e]=r}var ta=iP;function oP(t,e){return t===e||t!==t&&e!==e}var Wn=oP;var sP=Object.prototype,aP=sP.hasOwnProperty;function lP(t,e,r){var n=t[e];(!(aP.call(t,e)&&Wn(n,r))||r===void 0&&!(e in t))&&ta(t,e,r)}var Ki=lP;function uP(t,e,r,n){var i=!r;r||(r={});for(var o=-1,s=e.length;++o<s;){var a=e[o],l=n?n(r[a],t[a],a,r,t):void 0;l===void 0&&(l=t[a]),i?ta(r,a,l):Ki(r,a,l)}return r}var Gn=uP;var HE=Math.max;function cP(t,e,r){return e=HE(e===void 0?t.length-1:e,0),function(){for(var n=arguments,i=-1,o=HE(n.length-e,0),s=Array(o);++i<o;)s[i]=n[e+i];i=-1;for(var a=Array(e+1);++i<e;)a[i]=n[i];return a[e]=r(s),FE(t,this,a)}}var KE=cP;function fP(t,e){return GE(KE(t,e,Hr),t+"")}var ra=fP;var dP=9007199254740991;function pP(t){return typeof t=="number"&&t>-1&&t%1==0&&t<=dP}var na=pP;function mP(t){return t!=null&&na(t.length)&&!Cr(t)}var Kt=mP;function hP(t,e,r){if(!Nt(r))return!1;var n=typeof e;return(n=="number"?Kt(r)&&Hi(e,r.length):n=="string"&&e in r)?Wn(r[e],t):!1}var zi=hP;function gP(t){return ra(function(e,r){var n=-1,i=r.length,o=i>1?r[i-1]:void 0,s=i>2?r[2]:void 0;for(o=t.length>3&&typeof o=="function"?(i--,o):void 0,s&&zi(r[0],r[1],s)&&(o=i<3?void 0:o,i=1),e=Object(e);++n<i;){var a=r[n];a&&t(e,a,n,o)}return e})}var zE=gP;var TP=Object.prototype;function yP(t){var e=t&&t.constructor,r=typeof e=="function"&&e.prototype||TP;return t===r}var jn=yP;function _P(t,e){for(var r=-1,n=Array(t);++r<t;)n[r]=e(r);return n}var YE=_P;var vP="[object Arguments]";function RP(t){return Bt(t)&&Dr(t)==vP}var IT=RP;var XE=Object.prototype,xP=XE.hasOwnProperty,NP=XE.propertyIsEnumerable,EP=IT(function(){return arguments}())?IT:function(t){return Bt(t)&&xP.call(t,"callee")&&!NP.call(t,"callee")},Yi=EP;function IP(){return!1}var JE=IP;var eI=typeof exports=="object"&&exports&&!exports.nodeType&&exports,QE=eI&&typeof module=="object"&&module&&!module.nodeType&&module,OP=QE&&QE.exports===eI,ZE=OP?Ht.Buffer:void 0,AP=ZE?ZE.isBuffer:void 0,SP=AP||JE,ci=SP;var DP="[object Arguments]",CP="[object Array]",bP="[object Boolean]",LP="[object Date]",kP="[object Error]",wP="[object Function]",$P="[object Map]",PP="[object Number]",MP="[object Object]",FP="[object RegExp]",UP="[object Set]",VP="[object String]",BP="[object WeakMap]",WP="[object ArrayBuffer]",GP="[object DataView]",jP="[object Float32Array]",qP="[object Float64Array]",HP="[object Int8Array]",KP="[object Int16Array]",zP="[object Int32Array]",YP="[object Uint8Array]",XP="[object Uint8ClampedArray]",JP="[object Uint16Array]",QP="[object Uint32Array]",at={};at[jP]=at[qP]=at[HP]=at[KP]=at[zP]=at[YP]=at[XP]=at[JP]=at[QP]=!0;at[DP]=at[CP]=at[WP]=at[bP]=at[GP]=at[LP]=at[kP]=at[wP]=at[$P]=at[PP]=at[MP]=at[FP]=at[UP]=at[VP]=at[BP]=!1;function ZP(t){return Bt(t)&&na(t.length)&&!!at[Dr(t)]}var tI=ZP;function eM(t){return function(e){return t(e)}}var qn=eM;var rI=typeof exports=="object"&&exports&&!exports.nodeType&&exports,Pl=rI&&typeof module=="object"&&module&&!module.nodeType&&module,tM=Pl&&Pl.exports===rI,OT=tM&&Cf.process,rM=function(){try{var t=Pl&&Pl.require&&Pl.require("util").types;return t||OT&&OT.binding&&OT.binding("util")}catch{}}(),pn=rM;var nI=pn&&pn.isTypedArray,nM=nI?qn(nI):tI,ia=nM;var iM=Object.prototype,oM=iM.hasOwnProperty;function sM(t,e){var r=se(t),n=!r&&Yi(t),i=!r&&!n&&ci(t),o=!r&&!n&&!i&&ia(t),s=r||n||i||o,a=s?YE(t.length,String):[],l=a.length;for(var u in t)(e||oM.call(t,u))&&!(s&&(u=="length"||i&&(u=="offset"||u=="parent")||o&&(u=="buffer"||u=="byteLength"||u=="byteOffset")||Hi(u,l)))&&a.push(u);return a}var Pf=sM;function aM(t,e){return function(r){return t(e(r))}}var Mf=aM;var lM=Mf(Object.keys,Object),iI=lM;var uM=Object.prototype,cM=uM.hasOwnProperty;function fM(t){if(!jn(t))return iI(t);var e=[];for(var r in Object(t))cM.call(t,r)&&r!="constructor"&&e.push(r);return e}var Ff=fM;function dM(t){return Kt(t)?Pf(t):Ff(t)}var Ze=dM;var pM=Object.prototype,mM=pM.hasOwnProperty,hM=zE(function(t,e){if(jn(e)||Kt(e)){Gn(e,Ze(e),t);return}for(var r in e)mM.call(e,r)&&Ki(t,r,e[r])}),fr=hM;function gM(t){var e=[];if(t!=null)for(var r in Object(t))e.push(r);return e}var oI=gM;var TM=Object.prototype,yM=TM.hasOwnProperty;function _M(t){if(!Nt(t))return oI(t);var e=jn(t),r=[];for(var n in t)n=="constructor"&&(e||!yM.call(t,n))||r.push(n);return r}var sI=_M;function vM(t){return Kt(t)?Pf(t,!0):sI(t)}var Xi=vM;var RM=/\.|\[(?:[^[\]]*|(["'])(?:(?!\1)[^\\]|\\.)*?\1)\]/,xM=/^\w*$/;function NM(t,e){if(se(t))return!1;var r=typeof t;return r=="number"||r=="symbol"||r=="boolean"||t==null||Un(t)?!0:xM.test(t)||!RM.test(t)||e!=null&&t in Object(e)}var oa=NM;var EM=Kr(Object,"create"),fi=EM;function IM(){this.__data__=fi?fi(null):{},this.size=0}var aI=IM;function OM(t){var e=this.has(t)&&delete this.__data__[t];return this.size-=e?1:0,e}var lI=OM;var AM="__lodash_hash_undefined__",SM=Object.prototype,DM=SM.hasOwnProperty;function CM(t){var e=this.__data__;if(fi){var r=e[t];return r===AM?void 0:r}return DM.call(e,t)?e[t]:void 0}var uI=CM;var bM=Object.prototype,LM=bM.hasOwnProperty;function kM(t){var e=this.__data__;return fi?e[t]!==void 0:LM.call(e,t)}var cI=kM;var wM="__lodash_hash_undefined__";function $M(t,e){var r=this.__data__;return this.size+=this.has(t)?0:1,r[t]=fi&&e===void 0?wM:e,this}var fI=$M;function sa(t){var e=-1,r=t==null?0:t.length;for(this.clear();++e<r;){var n=t[e];this.set(n[0],n[1])}}sa.prototype.clear=aI;sa.prototype.delete=lI;sa.prototype.get=uI;sa.prototype.has=cI;sa.prototype.set=fI;var AT=sa;function PM(){this.__data__=[],this.size=0}var dI=PM;function MM(t,e){for(var r=t.length;r--;)if(Wn(t[r][0],e))return r;return-1}var Ji=MM;var FM=Array.prototype,UM=FM.splice;function VM(t){var e=this.__data__,r=Ji(e,t);if(r<0)return!1;var n=e.length-1;return r==n?e.pop():UM.call(e,r,1),--this.size,!0}var pI=VM;function BM(t){var e=this.__data__,r=Ji(e,t);return r<0?void 0:e[r][1]}var mI=BM;function WM(t){return Ji(this.__data__,t)>-1}var hI=WM;function GM(t,e){var r=this.__data__,n=Ji(r,t);return n<0?(++this.size,r.push([t,e])):r[n][1]=e,this}var gI=GM;function aa(t){var e=-1,r=t==null?0:t.length;for(this.clear();++e<r;){var n=t[e];this.set(n[0],n[1])}}aa.prototype.clear=dI;aa.prototype.delete=pI;aa.prototype.get=mI;aa.prototype.has=hI;aa.prototype.set=gI;var Qi=aa;var jM=Kr(Ht,"Map"),Zi=jM;function qM(){this.size=0,this.__data__={hash:new AT,map:new(Zi||Qi),string:new AT}}var TI=qM;function HM(t){var e=typeof t;return e=="string"||e=="number"||e=="symbol"||e=="boolean"?t!=="__proto__":t===null}var yI=HM;function KM(t,e){var r=t.__data__;return yI(e)?r[typeof e=="string"?"string":"hash"]:r.map}var eo=KM;function zM(t){var e=eo(this,t).delete(t);return this.size-=e?1:0,e}var _I=zM;function YM(t){return eo(this,t).get(t)}var vI=YM;function XM(t){return eo(this,t).has(t)}var RI=XM;function JM(t,e){var r=eo(this,t),n=r.size;return r.set(t,e),this.size+=r.size==n?0:1,this}var xI=JM;function la(t){var e=-1,r=t==null?0:t.length;for(this.clear();++e<r;){var n=t[e];this.set(n[0],n[1])}}la.prototype.clear=TI;la.prototype.delete=_I;la.prototype.get=vI;la.prototype.has=RI;la.prototype.set=xI;var Fo=la;var QM="Expected a function";function ST(t,e){if(typeof t!="function"||e!=null&&typeof e!="function")throw new TypeError(QM);var r=function(){var n=arguments,i=e?e.apply(this,n):n[0],o=r.cache;if(o.has(i))return o.get(i);var s=t.apply(this,n);return r.cache=o.set(i,s)||o,s};return r.cache=new(ST.Cache||Fo),r}ST.Cache=Fo;var NI=ST;var ZM=500;function e0(t){var e=NI(t,function(n){return r.size===ZM&&r.clear(),n}),r=e.cache;return e}var EI=e0;var t0=/[^.[\]]+|\[(?:(-?\d+(?:\.\d+)?)|(["'])((?:(?!\2)[^\\]|\\.)*?)\2)\]|(?=(?:\.|\[\])(?:\.|\[\]|$))/g,r0=/\\(\\)?/g,n0=EI(function(t){var e=[];return t.charCodeAt(0)===46&&e.push(""),t.replace(t0,function(r,n,i,o){e.push(i?o.replace(r0,"$1"):n||r)}),e}),II=n0;function i0(t){return t==null?"":IE(t)}var OI=i0;function o0(t,e){return se(t)?t:oa(t,e)?[t]:II(OI(t))}var to=o0;var s0=1/0;function a0(t){if(typeof t=="string"||Un(t))return t;var e=t+"";return e=="0"&&1/t==-s0?"-0":e}var Hn=a0;function l0(t,e){e=to(e,t);for(var r=0,n=e.length;t!=null&&r<n;)t=t[Hn(e[r++])];return r&&r==n?t:void 0}var ua=l0;function u0(t,e,r){var n=t==null?void 0:ua(t,e);return n===void 0?r:n}var AI=u0;function c0(t,e){for(var r=-1,n=e.length,i=t.length;++r<n;)t[i+r]=e[r];return t}var ca=c0;var SI=nr?nr.isConcatSpreadable:void 0;function f0(t){return se(t)||Yi(t)||!!(SI&&t&&t[SI])}var DI=f0;function CI(t,e,r,n,i){var o=-1,s=t.length;for(r||(r=DI),i||(i=[]);++o<s;){var a=t[o];e>0&&r(a)?e>1?CI(a,e-1,r,n,i):ca(i,a):n||(i[i.length]=a)}return i}var fa=CI;function d0(t){var e=t==null?0:t.length;return e?fa(t,1):[]}var Wt=d0;var p0=Mf(Object.getPrototypeOf,Object),Uf=p0;function m0(t,e,r){var n=-1,i=t.length;e<0&&(e=-e>i?0:i+e),r=r>i?i:r,r<0&&(r+=i),i=e>r?0:r-e>>>0,e>>>=0;for(var o=Array(i);++n<i;)o[n]=t[n+e];return o}var Vf=m0;function h0(t,e,r,n){var i=-1,o=t==null?0:t.length;for(n&&o&&(r=t[++i]);++i<o;)r=e(r,t[i],i,t);return r}var bI=h0;function g0(){this.__data__=new Qi,this.size=0}var LI=g0;function T0(t){var e=this.__data__,r=e.delete(t);return this.size=e.size,r}var kI=T0;function y0(t){return this.__data__.get(t)}var wI=y0;function _0(t){return this.__data__.has(t)}var $I=_0;var v0=200;function R0(t,e){var r=this.__data__;if(r instanceof Qi){var n=r.__data__;if(!Zi||n.length<v0-1)return n.push([t,e]),this.size=++r.size,this;r=this.__data__=new Fo(n)}return r.set(t,e),this.size=r.size,this}var PI=R0;function da(t){var e=this.__data__=new Qi(t);this.size=e.size}da.prototype.clear=LI;da.prototype.delete=kI;da.prototype.get=wI;da.prototype.has=$I;da.prototype.set=PI;var ro=da;function x0(t,e){return t&&Gn(e,Ze(e),t)}var MI=x0;function N0(t,e){return t&&Gn(e,Xi(e),t)}var FI=N0;var WI=typeof exports=="object"&&exports&&!exports.nodeType&&exports,UI=WI&&typeof module=="object"&&module&&!module.nodeType&&module,E0=UI&&UI.exports===WI,VI=E0?Ht.Buffer:void 0,BI=VI?VI.allocUnsafe:void 0;function I0(t,e){if(e)return t.slice();var r=t.length,n=BI?BI(r):new t.constructor(r);return t.copy(n),n}var GI=I0;function O0(t,e){for(var r=-1,n=t==null?0:t.length,i=0,o=[];++r<n;){var s=t[r];e(s,r,t)&&(o[i++]=s)}return o}var pa=O0;function A0(){return[]}var Bf=A0;var S0=Object.prototype,D0=S0.propertyIsEnumerable,jI=Object.getOwnPropertySymbols,C0=jI?function(t){return t==null?[]:(t=Object(t),pa(jI(t),function(e){return D0.call(t,e)}))}:Bf,ma=C0;function b0(t,e){return Gn(t,ma(t),e)}var qI=b0;var L0=Object.getOwnPropertySymbols,k0=L0?function(t){for(var e=[];t;)ca(e,ma(t)),t=Uf(t);return e}:Bf,Wf=k0;function w0(t,e){return Gn(t,Wf(t),e)}var HI=w0;function $0(t,e,r){var n=e(t);return se(t)?n:ca(n,r(t))}var Gf=$0;function P0(t){return Gf(t,Ze,ma)}var Ml=P0;function M0(t){return Gf(t,Xi,Wf)}var jf=M0;var F0=Kr(Ht,"DataView"),qf=F0;var U0=Kr(Ht,"Promise"),Hf=U0;var V0=Kr(Ht,"Set"),no=V0;var KI="[object Map]",B0="[object Object]",zI="[object Promise]",YI="[object Set]",XI="[object WeakMap]",JI="[object DataView]",W0=ui(qf),G0=ui(Zi),j0=ui(Hf),q0=ui(no),H0=ui(Lf),Uo=Dr;(qf&&Uo(new qf(new ArrayBuffer(1)))!=JI||Zi&&Uo(new Zi)!=KI||Hf&&Uo(Hf.resolve())!=zI||no&&Uo(new no)!=YI||Lf&&Uo(new Lf)!=XI)&&(Uo=function(t){var e=Dr(t),r=e==B0?t.constructor:void 0,n=r?ui(r):"";if(n)switch(n){case W0:return JI;case G0:return KI;case j0:return zI;case q0:return YI;case H0:return XI}return e});var An=Uo;var K0=Object.prototype,z0=K0.hasOwnProperty;function Y0(t){var e=t.length,r=new t.constructor(e);return e&&typeof t[0]=="string"&&z0.call(t,"index")&&(r.index=t.index,r.input=t.input),r}var QI=Y0;var X0=Ht.Uint8Array,ha=X0;function J0(t){var e=new t.constructor(t.byteLength);return new ha(e).set(new ha(t)),e}var ga=J0;function Q0(t,e){var r=e?ga(t.buffer):t.buffer;return new t.constructor(r,t.byteOffset,t.byteLength)}var ZI=Q0;var Z0=/\w*$/;function eF(t){var e=new t.constructor(t.source,Z0.exec(t));return e.lastIndex=t.lastIndex,e}var eO=eF;var tO=nr?nr.prototype:void 0,rO=tO?tO.valueOf:void 0;function tF(t){return rO?Object(rO.call(t)):{}}var nO=tF;function rF(t,e){var r=e?ga(t.buffer):t.buffer;return new t.constructor(r,t.byteOffset,t.length)}var iO=rF;var nF="[object Boolean]",iF="[object Date]",oF="[object Map]",sF="[object Number]",aF="[object RegExp]",lF="[object Set]",uF="[object String]",cF="[object Symbol]",fF="[object ArrayBuffer]",dF="[object DataView]",pF="[object Float32Array]",mF="[object Float64Array]",hF="[object Int8Array]",gF="[object Int16Array]",TF="[object Int32Array]",yF="[object Uint8Array]",_F="[object Uint8ClampedArray]",vF="[object Uint16Array]",RF="[object Uint32Array]";function xF(t,e,r){var n=t.constructor;switch(e){case fF:return ga(t);case nF:case iF:return new n(+t);case dF:return ZI(t,r);case pF:case mF:case hF:case gF:case TF:case yF:case _F:case vF:case RF:return iO(t,r);case oF:return new n;case sF:case uF:return new n(t);case aF:return eO(t);case lF:return new n;case cF:return nO(t)}}var oO=xF;function NF(t){return typeof t.constructor=="function"&&!jn(t)?ME(Uf(t)):{}}var sO=NF;var EF="[object Map]";function IF(t){return Bt(t)&&An(t)==EF}var aO=IF;var lO=pn&&pn.isMap,OF=lO?qn(lO):aO,uO=OF;var AF="[object Set]";function SF(t){return Bt(t)&&An(t)==AF}var cO=SF;var fO=pn&&pn.isSet,DF=fO?qn(fO):cO,dO=DF;var CF=1,bF=2,LF=4,pO="[object Arguments]",kF="[object Array]",wF="[object Boolean]",$F="[object Date]",PF="[object Error]",mO="[object Function]",MF="[object GeneratorFunction]",FF="[object Map]",UF="[object Number]",hO="[object Object]",VF="[object RegExp]",BF="[object Set]",WF="[object String]",GF="[object Symbol]",jF="[object WeakMap]",qF="[object ArrayBuffer]",HF="[object DataView]",KF="[object Float32Array]",zF="[object Float64Array]",YF="[object Int8Array]",XF="[object Int16Array]",JF="[object Int32Array]",QF="[object Uint8Array]",ZF="[object Uint8ClampedArray]",eU="[object Uint16Array]",tU="[object Uint32Array]",et={};et[pO]=et[kF]=et[qF]=et[HF]=et[wF]=et[$F]=et[KF]=et[zF]=et[YF]=et[XF]=et[JF]=et[FF]=et[UF]=et[hO]=et[VF]=et[BF]=et[WF]=et[GF]=et[QF]=et[ZF]=et[eU]=et[tU]=!0;et[PF]=et[mO]=et[jF]=!1;function Kf(t,e,r,n,i,o){var s,a=e&CF,l=e&bF,u=e&LF;if(r&&(s=i?r(t,n,i,o):r(t)),s!==void 0)return s;if(!Nt(t))return t;var c=se(t);if(c){if(s=QI(t),!a)return UE(t,s)}else{var f=An(t),d=f==mO||f==MF;if(ci(t))return GI(t,a);if(f==hO||f==pO||d&&!i){if(s=l||d?{}:sO(t),!a)return l?HI(t,FI(s,t)):qI(t,MI(s,t))}else{if(!et[f])return i?t:{};s=oO(t,f,a)}}o||(o=new ro);var m=o.get(t);if(m)return m;o.set(t,s),dO(t)?t.forEach(function(A){s.add(Kf(A,e,r,A,t,o))}):uO(t)&&t.forEach(function(A,I){s.set(I,Kf(A,e,r,I,t,o))});var _=u?l?jf:Ml:l?Xi:Ze,x=c?void 0:_(t);return kf(x||t,function(A,I){x&&(I=A,A=t[I]),Ki(s,I,Kf(A,e,r,I,t,o))}),s}var gO=Kf;var rU=4;function nU(t){return gO(t,rU)}var tt=nU;function iU(t){for(var e=-1,r=t==null?0:t.length,n=0,i=[];++e<r;){var o=t[e];o&&(i[n++]=o)}return i}var Kn=iU;var oU="__lodash_hash_undefined__";function sU(t){return this.__data__.set(t,oU),this}var TO=sU;function aU(t){return this.__data__.has(t)}var yO=aU;function zf(t){var e=-1,r=t==null?0:t.length;for(this.__data__=new Fo;++e<r;)this.add(t[e])}zf.prototype.add=zf.prototype.push=TO;zf.prototype.has=yO;var Ta=zf;function lU(t,e){for(var r=-1,n=t==null?0:t.length;++r<n;)if(e(t[r],r,t))return!0;return!1}var Yf=lU;function uU(t,e){return t.has(e)}var ya=uU;var cU=1,fU=2;function dU(t,e,r,n,i,o){var s=r&cU,a=t.length,l=e.length;if(a!=l&&!(s&&l>a))return!1;var u=o.get(t),c=o.get(e);if(u&&c)return u==e&&c==t;var f=-1,d=!0,m=r&fU?new Ta:void 0;for(o.set(t,e),o.set(e,t);++f<a;){var _=t[f],x=e[f];if(n)var A=s?n(x,_,f,e,t,o):n(_,x,f,t,e,o);if(A!==void 0){if(A)continue;d=!1;break}if(m){if(!Yf(e,function(I,y){if(!ya(m,y)&&(_===I||i(_,I,r,n,o)))return m.push(y)})){d=!1;break}}else if(!(_===x||i(_,x,r,n,o))){d=!1;break}}return o.delete(t),o.delete(e),d}var Xf=dU;function pU(t){var e=-1,r=Array(t.size);return t.forEach(function(n,i){r[++e]=[i,n]}),r}var _O=pU;function mU(t){var e=-1,r=Array(t.size);return t.forEach(function(n){r[++e]=n}),r}var _a=mU;var hU=1,gU=2,TU="[object Boolean]",yU="[object Date]",_U="[object Error]",vU="[object Map]",RU="[object Number]",xU="[object RegExp]",NU="[object Set]",EU="[object String]",IU="[object Symbol]",OU="[object ArrayBuffer]",AU="[object DataView]",vO=nr?nr.prototype:void 0,DT=vO?vO.valueOf:void 0;function SU(t,e,r,n,i,o,s){switch(r){case AU:if(t.byteLength!=e.byteLength||t.byteOffset!=e.byteOffset)return!1;t=t.buffer,e=e.buffer;case OU:return!(t.byteLength!=e.byteLength||!o(new ha(t),new ha(e)));case TU:case yU:case RU:return Wn(+t,+e);case _U:return t.name==e.name&&t.message==e.message;case xU:case EU:return t==e+"";case vU:var a=_O;case NU:var l=n&hU;if(a||(a=_a),t.size!=e.size&&!l)return!1;var u=s.get(t);if(u)return u==e;n|=gU,s.set(t,e);var c=Xf(a(t),a(e),n,i,o,s);return s.delete(t),c;case IU:if(DT)return DT.call(t)==DT.call(e)}return!1}var RO=SU;var DU=1,CU=Object.prototype,bU=CU.hasOwnProperty;function LU(t,e,r,n,i,o){var s=r&DU,a=Ml(t),l=a.length,u=Ml(e),c=u.length;if(l!=c&&!s)return!1;for(var f=l;f--;){var d=a[f];if(!(s?d in e:bU.call(e,d)))return!1}var m=o.get(t),_=o.get(e);if(m&&_)return m==e&&_==t;var x=!0;o.set(t,e),o.set(e,t);for(var A=s;++f<l;){d=a[f];var I=t[d],y=e[d];if(n)var g=s?n(y,I,d,e,t,o):n(I,y,d,t,e,o);if(!(g===void 0?I===y||i(I,y,r,n,o):g)){x=!1;break}A||(A=d=="constructor")}if(x&&!A){var O=t.constructor,M=e.constructor;O!=M&&"constructor"in t&&"constructor"in e&&!(typeof O=="function"&&O instanceof O&&typeof M=="function"&&M instanceof M)&&(x=!1)}return o.delete(t),o.delete(e),x}var xO=LU;var kU=1,NO="[object Arguments]",EO="[object Array]",Jf="[object Object]",wU=Object.prototype,IO=wU.hasOwnProperty;function $U(t,e,r,n,i,o){var s=se(t),a=se(e),l=s?EO:An(t),u=a?EO:An(e);l=l==NO?Jf:l,u=u==NO?Jf:u;var c=l==Jf,f=u==Jf,d=l==u;if(d&&ci(t)){if(!ci(e))return!1;s=!0,c=!1}if(d&&!c)return o||(o=new ro),s||ia(t)?Xf(t,e,r,n,i,o):RO(t,e,l,r,n,i,o);if(!(r&kU)){var m=c&&IO.call(t,"__wrapped__"),_=f&&IO.call(e,"__wrapped__");if(m||_){var x=m?t.value():t,A=_?e.value():e;return o||(o=new ro),i(x,A,r,n,o)}}return d?(o||(o=new ro),xO(t,e,r,n,i,o)):!1}var OO=$U;function AO(t,e,r,n,i){return t===e?!0:t==null||e==null||!Bt(t)&&!Bt(e)?t!==t&&e!==e:OO(t,e,r,n,AO,i)}var Qf=AO;var PU=1,MU=2;function FU(t,e,r,n){var i=r.length,o=i,s=!n;if(t==null)return!o;for(t=Object(t);i--;){var a=r[i];if(s&&a[2]?a[1]!==t[a[0]]:!(a[0]in t))return!1}for(;++i<o;){a=r[i];var l=a[0],u=t[l],c=a[1];if(s&&a[2]){if(u===void 0&&!(l in t))return!1}else{var f=new ro;if(n)var d=n(u,c,l,t,e,f);if(!(d===void 0?Qf(c,u,PU|MU,n,f):d))return!1}}return!0}var SO=FU;function UU(t){return t===t&&!Nt(t)}var Zf=UU;function VU(t){for(var e=Ze(t),r=e.length;r--;){var n=e[r],i=t[n];e[r]=[n,i,Zf(i)]}return e}var DO=VU;function BU(t,e){return function(r){return r==null?!1:r[t]===e&&(e!==void 0||t in Object(r))}}var ed=BU;function WU(t){var e=DO(t);return e.length==1&&e[0][2]?ed(e[0][0],e[0][1]):function(r){return r===t||SO(r,t,e)}}var CO=WU;function GU(t,e){return t!=null&&e in Object(t)}var bO=GU;function jU(t,e,r){e=to(e,t);for(var n=-1,i=e.length,o=!1;++n<i;){var s=Hn(e[n]);if(!(o=t!=null&&r(t,s)))break;t=t[s]}return o||++n!=i?o:(i=t==null?0:t.length,!!i&&na(i)&&Hi(s,i)&&(se(t)||Yi(t)))}var td=jU;function qU(t,e){return t!=null&&td(t,e,bO)}var LO=qU;var HU=1,KU=2;function zU(t,e){return oa(t)&&Zf(e)?ed(Hn(t),e):function(r){var n=AI(r,t);return n===void 0&&n===e?LO(r,t):Qf(e,n,HU|KU)}}var kO=zU;function YU(t){return function(e){return e==null?void 0:e[t]}}var wO=YU;function XU(t){return function(e){return ua(e,t)}}var $O=XU;function JU(t){return oa(t)?wO(Hn(t)):$O(t)}var PO=JU;function QU(t){return typeof t=="function"?t:t==null?Hr:typeof t=="object"?se(t)?kO(t[0],t[1]):CO(t):PO(t)}var Lt=QU;function ZU(t,e,r,n){for(var i=-1,o=t==null?0:t.length;++i<o;){var s=t[i];e(n,s,r(s),t)}return n}var MO=ZU;function e1(t){return function(e,r,n){for(var i=-1,o=Object(e),s=n(e),a=s.length;a--;){var l=s[t?a:++i];if(r(o[l],l,o)===!1)break}return e}}var FO=e1;var t1=FO(),UO=t1;function r1(t,e){return t&&UO(t,e,Ze)}var VO=r1;function n1(t,e){return function(r,n){if(r==null)return r;if(!Kt(r))return t(r,n);for(var i=r.length,o=e?i:-1,s=Object(r);(e?o--:++o<i)&&n(s[o],o,s)!==!1;);return r}}var BO=n1;var i1=BO(VO),zr=i1;function o1(t,e,r,n){return zr(t,function(i,o,s){e(n,i,r(i),s)}),n}var WO=o1;function s1(t,e){return function(r,n){var i=se(r)?MO:WO,o=e?e():{};return i(r,t,Lt(n,2),o)}}var GO=s1;var jO=Object.prototype,a1=jO.hasOwnProperty,l1=ra(function(t,e){t=Object(t);var r=-1,n=e.length,i=n>2?e[2]:void 0;for(i&&zi(e[0],e[1],i)&&(n=1);++r<n;)for(var o=e[r],s=Xi(o),a=-1,l=s.length;++a<l;){var u=s[a],c=t[u];(c===void 0||Wn(c,jO[u])&&!a1.call(t,u))&&(t[u]=o[u])}return t}),va=l1;function u1(t){return Bt(t)&&Kt(t)}var CT=u1;function c1(t,e,r){for(var n=-1,i=t==null?0:t.length;++n<i;)if(r(e,t[n]))return!0;return!1}var rd=c1;var f1=200;function d1(t,e,r,n){var i=-1,o=$f,s=!0,a=t.length,l=[],u=e.length;if(!a)return l;r&&(e=Vn(e,qn(r))),n?(o=rd,s=!1):e.length>=f1&&(o=ya,s=!1,e=new Ta(e));e:for(;++i<a;){var c=t[i],f=r==null?c:r(c);if(c=n||c!==0?c:0,s&&f===f){for(var d=u;d--;)if(e[d]===f)continue e;l.push(c)}else o(e,f,n)||l.push(c)}return l}var qO=d1;var p1=ra(function(t,e){return CT(t)?qO(t,fa(e,1,CT,!0)):[]}),io=p1;function m1(t){var e=t==null?0:t.length;return e?t[e-1]:void 0}var zn=m1;function h1(t,e,r){var n=t==null?0:t.length;return n?(e=r||e===void 0?1:Bn(e),Vf(t,e<0?0:e,n)):[]}var Gt=h1;function g1(t,e,r){var n=t==null?0:t.length;return n?(e=r||e===void 0?1:Bn(e),e=n-e,Vf(t,0,e<0?0:e)):[]}var di=g1;function T1(t){return typeof t=="function"?t:Hr}var HO=T1;function y1(t,e){var r=se(t)?kf:zr;return r(t,HO(e))}var Z=y1;function _1(t,e){for(var r=-1,n=t==null?0:t.length;++r<n;)if(!e(t[r],r,t))return!1;return!0}var KO=_1;function v1(t,e){var r=!0;return zr(t,function(n,i,o){return r=!!e(n,i,o),r}),r}var zO=v1;function R1(t,e,r){var n=se(t)?KO:zO;return r&&zi(t,e,r)&&(e=void 0),n(t,Lt(e,3))}var Rr=R1;function x1(t,e){var r=[];return zr(t,function(n,i,o){e(n,i,o)&&r.push(n)}),r}var nd=x1;function N1(t,e){var r=se(t)?pa:nd;return r(t,Lt(e,3))}var ir=N1;function E1(t){return function(e,r,n){var i=Object(e);if(!Kt(e)){var o=Lt(r,3);e=Ze(e),r=function(a){return o(i[a],a,i)}}var s=t(e,r,n);return s>-1?i[o?e[s]:s]:void 0}}var YO=E1;var I1=Math.max;function O1(t,e,r){var n=t==null?0:t.length;if(!n)return-1;var i=r==null?0:Bn(r);return i<0&&(i=I1(n+i,0)),wf(t,Lt(e,3),i)}var XO=O1;var A1=YO(XO),Yn=A1;function S1(t){return t&&t.length?t[0]:void 0}var or=S1;function D1(t,e){var r=-1,n=Kt(t)?Array(t.length):[];return zr(t,function(i,o,s){n[++r]=e(i,o,s)}),n}var JO=D1;function C1(t,e){var r=se(t)?Vn:JO;return r(t,Lt(e,3))}var K=C1;function b1(t,e){return fa(K(t,e),1)}var dr=b1;var L1=Object.prototype,k1=L1.hasOwnProperty,w1=GO(function(t,e,r){k1.call(t,r)?t[r].push(e):ta(t,r,[e])}),bT=w1;var $1=Object.prototype,P1=$1.hasOwnProperty;function M1(t,e){return t!=null&&P1.call(t,e)}var QO=M1;function F1(t,e){return t!=null&&td(t,e,QO)}var te=F1;var U1="[object String]";function V1(t){return typeof t=="string"||!se(t)&&Bt(t)&&Dr(t)==U1}var Zt=V1;function B1(t,e){return Vn(e,function(r){return t[r]})}var ZO=B1;function W1(t){return t==null?[]:ZO(t,Ze(t))}var We=W1;var G1=Math.max;function j1(t,e,r,n){t=Kt(t)?t:We(t),r=r&&!n?Bn(r):0;var i=t.length;return r<0&&(r=G1(i+r,0)),Zt(t)?r<=i&&t.indexOf(e,r)>-1:!!i&&ea(t,e,r)>-1}var dt=j1;var q1=Math.max;function H1(t,e,r){var n=t==null?0:t.length;if(!n)return-1;var i=r==null?0:Bn(r);return i<0&&(i=q1(n+i,0)),ea(t,e,i)}var id=H1;var K1="[object Map]",z1="[object Set]",Y1=Object.prototype,X1=Y1.hasOwnProperty;function J1(t){if(t==null)return!0;if(Kt(t)&&(se(t)||typeof t=="string"||typeof t.splice=="function"||ci(t)||ia(t)||Yi(t)))return!t.length;var e=An(t);if(e==K1||e==z1)return!t.size;if(jn(t))return!Ff(t).length;for(var r in t)if(X1.call(t,r))return!1;return!0}var ve=J1;var Q1="[object RegExp]";function Z1(t){return Bt(t)&&Dr(t)==Q1}var eA=Z1;var tA=pn&&pn.isRegExp,eV=tA?qn(tA):eA,mn=eV;function tV(t){return t===void 0}var xr=tV;function rV(t,e){return t<e}var rA=rV;function nV(t,e,r){for(var n=-1,i=t.length;++n<i;){var o=t[n],s=e(o);if(s!=null&&(a===void 0?s===s&&!Un(s):r(s,a)))var a=s,l=o}return l}var nA=nV;function iV(t){return t&&t.length?nA(t,Hr,rA):void 0}var iA=iV;var oV="Expected a function";function sV(t){if(typeof t!="function")throw new TypeError(oV);return function(){var e=arguments;switch(e.length){case 0:return!t.call(this);case 1:return!t.call(this,e[0]);case 2:return!t.call(this,e[0],e[1]);case 3:return!t.call(this,e[0],e[1],e[2])}return!t.apply(this,e)}}var oA=sV;function aV(t,e,r,n){if(!Nt(t))return t;e=to(e,t);for(var i=-1,o=e.length,s=o-1,a=t;a!=null&&++i<o;){var l=Hn(e[i]),u=r;if(l==="__proto__"||l==="constructor"||l==="prototype")return t;if(i!=s){var c=a[l];u=n?n(c,l,a):void 0,u===void 0&&(u=Nt(c)?c:Hi(e[i+1])?[]:{})}Ki(a,l,u),a=a[l]}return t}var sA=aV;function lV(t,e,r){for(var n=-1,i=e.length,o={};++n<i;){var s=e[n],a=ua(t,s);r(a,s)&&sA(o,to(s,t),a)}return o}var aA=lV;function uV(t,e){if(t==null)return{};var r=Vn(jf(t),function(n){return[n]});return e=Lt(e),aA(t,r,function(n,i){return e(n,i[0])})}var Yr=uV;function cV(t,e,r,n,i){return i(t,function(o,s,a){r=n?(n=!1,o):e(r,o,s,a)}),r}var lA=cV;function fV(t,e,r){var n=se(t)?bI:lA,i=arguments.length<3;return n(t,Lt(e,4),r,i,zr)}var It=fV;function dV(t,e){var r=se(t)?pa:nd;return r(t,oA(Lt(e,3)))}var oo=dV;function pV(t,e){var r;return zr(t,function(n,i,o){return r=e(n,i,o),!r}),!!r}var uA=pV;function mV(t,e,r){var n=se(t)?Yf:uA;return r&&zi(t,e,r)&&(e=void 0),n(t,Lt(e,3))}var Fl=mV;var hV=1/0,gV=no&&1/_a(new no([,-0]))[1]==hV?function(t){return new no(t)}:Et,cA=gV;var TV=200;function yV(t,e,r){var n=-1,i=$f,o=t.length,s=!0,a=[],l=a;if(r)s=!1,i=rd;else if(o>=TV){var u=e?null:cA(t);if(u)return _a(u);s=!1,i=ya,l=new Ta}else l=e?[]:a;e:for(;++n<o;){var c=t[n],f=e?e(c):c;if(c=r||c!==0?c:0,s&&f===f){for(var d=l.length;d--;)if(l[d]===f)continue e;e&&l.push(f),a.push(c)}else i(l,f,r)||(l!==a&&l.push(f),a.push(c))}return a}var od=yV;function _V(t){return t&&t.length?od(t):[]}var Ra=_V;function vV(t,e){return t&&t.length?od(t,Lt(e,2)):[]}var fA=vV;function xa(t){console&&console.error&&console.error(`Error: ${t}`)}function Ul(t){console&&console.warn&&console.warn(`Warning: ${t}`)}function Vl(t){let e=new Date().getTime(),r=t();return{time:new Date().getTime()-e,value:r}}function Bl(t){function e(){}e.prototype=t;let r=new e;function n(){return typeof r.bar}return n(),n(),t;(0,eval)(t)}function RV(t){return xV(t)?t.LABEL:t.name}function xV(t){return Zt(t.LABEL)&&t.LABEL!==""}var rn=class{get definition(){return this._definition}set definition(e){this._definition=e}constructor(e){this._definition=e}accept(e){e.visit(this),Z(this.definition,r=>{r.accept(e)})}},Fe=class extends rn{constructor(e){super([]),this.idx=1,fr(this,Yr(e,r=>r!==void 0))}set definition(e){}get definition(){return this.referencedRule!==void 0?this.referencedRule.definition:[]}accept(e){e.visit(this)}},br=class extends rn{constructor(e){super(e.definition),this.orgText="",fr(this,Yr(e,r=>r!==void 0))}},rt=class extends rn{constructor(e){super(e.definition),this.ignoreAmbiguities=!1,fr(this,Yr(e,r=>r!==void 0))}},Ue=class extends rn{constructor(e){super(e.definition),this.idx=1,fr(this,Yr(e,r=>r!==void 0))}},nt=class extends rn{constructor(e){super(e.definition),this.idx=1,fr(this,Yr(e,r=>r!==void 0))}},it=class extends rn{constructor(e){super(e.definition),this.idx=1,fr(this,Yr(e,r=>r!==void 0))}},Oe=class extends rn{constructor(e){super(e.definition),this.idx=1,fr(this,Yr(e,r=>r!==void 0))}},Ke=class extends rn{constructor(e){super(e.definition),this.idx=1,fr(this,Yr(e,r=>r!==void 0))}},ze=class extends rn{get definition(){return this._definition}set definition(e){this._definition=e}constructor(e){super(e.definition),this.idx=1,this.ignoreAmbiguities=!1,this.hasPredicates=!1,fr(this,Yr(e,r=>r!==void 0))}},Re=class{constructor(e){this.idx=1,fr(this,Yr(e,r=>r!==void 0))}accept(e){e.visit(this)}};function sd(t){return K(t,Na)}function Na(t){function e(r){return K(r,Na)}if(t instanceof Fe){let r={type:"NonTerminal",name:t.nonTerminalName,idx:t.idx};return Zt(t.label)&&(r.label=t.label),r}else{if(t instanceof rt)return{type:"Alternative",definition:e(t.definition)};if(t instanceof Ue)return{type:"Option",idx:t.idx,definition:e(t.definition)};if(t instanceof nt)return{type:"RepetitionMandatory",idx:t.idx,definition:e(t.definition)};if(t instanceof it)return{type:"RepetitionMandatoryWithSeparator",idx:t.idx,separator:Na(new Re({terminalType:t.separator})),definition:e(t.definition)};if(t instanceof Ke)return{type:"RepetitionWithSeparator",idx:t.idx,separator:Na(new Re({terminalType:t.separator})),definition:e(t.definition)};if(t instanceof Oe)return{type:"Repetition",idx:t.idx,definition:e(t.definition)};if(t instanceof ze)return{type:"Alternation",idx:t.idx,definition:e(t.definition)};if(t instanceof Re){let r={type:"Terminal",name:t.terminalType.name,label:RV(t.terminalType),idx:t.idx};Zt(t.label)&&(r.terminalLabel=t.label);let n=t.terminalType.PATTERN;return t.terminalType.PATTERN&&(r.pattern=mn(n)?n.source:n),r}else{if(t instanceof br)return{type:"Rule",name:t.name,orgText:t.orgText,definition:e(t.definition)};throw Error("non exhaustive match")}}}var Lr=class{visit(e){let r=e;switch(r.constructor){case Fe:return this.visitNonTerminal(r);case rt:return this.visitAlternative(r);case Ue:return this.visitOption(r);case nt:return this.visitRepetitionMandatory(r);case it:return this.visitRepetitionMandatoryWithSeparator(r);case Ke:return this.visitRepetitionWithSeparator(r);case Oe:return this.visitRepetition(r);case ze:return this.visitAlternation(r);case Re:return this.visitTerminal(r);case br:return this.visitRule(r);default:throw Error("non exhaustive match")}}visitNonTerminal(e){}visitAlternative(e){}visitOption(e){}visitRepetition(e){}visitRepetitionMandatory(e){}visitRepetitionMandatoryWithSeparator(e){}visitRepetitionWithSeparator(e){}visitAlternation(e){}visitTerminal(e){}visitRule(e){}};function LT(t){return t instanceof rt||t instanceof Ue||t instanceof Oe||t instanceof nt||t instanceof it||t instanceof Ke||t instanceof Re||t instanceof br}function Vo(t,e=[]){return t instanceof Ue||t instanceof Oe||t instanceof Ke?!0:t instanceof ze?Fl(t.definition,n=>Vo(n,e)):t instanceof Fe&&dt(e,t)?!1:t instanceof rn?(t instanceof Fe&&e.push(t),Rr(t.definition,n=>Vo(n,e))):!1}function kT(t){return t instanceof ze}function Xr(t){if(t instanceof Fe)return"SUBRULE";if(t instanceof Ue)return"OPTION";if(t instanceof ze)return"OR";if(t instanceof nt)return"AT_LEAST_ONE";if(t instanceof it)return"AT_LEAST_ONE_SEP";if(t instanceof Ke)return"MANY_SEP";if(t instanceof Oe)return"MANY";if(t instanceof Re)return"CONSUME";throw Error("non exhaustive match")}var pi=class{walk(e,r=[]){Z(e.definition,(n,i)=>{let o=Gt(e.definition,i+1);if(n instanceof Fe)this.walkProdRef(n,o,r);else if(n instanceof Re)this.walkTerminal(n,o,r);else if(n instanceof rt)this.walkFlat(n,o,r);else if(n instanceof Ue)this.walkOption(n,o,r);else if(n instanceof nt)this.walkAtLeastOne(n,o,r);else if(n instanceof it)this.walkAtLeastOneSep(n,o,r);else if(n instanceof Ke)this.walkManySep(n,o,r);else if(n instanceof Oe)this.walkMany(n,o,r);else if(n instanceof ze)this.walkOr(n,o,r);else throw Error("non exhaustive match")})}walkTerminal(e,r,n){}walkProdRef(e,r,n){}walkFlat(e,r,n){let i=r.concat(n);this.walk(e,i)}walkOption(e,r,n){let i=r.concat(n);this.walk(e,i)}walkAtLeastOne(e,r,n){let i=[new Ue({definition:e.definition})].concat(r,n);this.walk(e,i)}walkAtLeastOneSep(e,r,n){let i=dA(e,r,n);this.walk(e,i)}walkMany(e,r,n){let i=[new Ue({definition:e.definition})].concat(r,n);this.walk(e,i)}walkManySep(e,r,n){let i=dA(e,r,n);this.walk(e,i)}walkOr(e,r,n){let i=r.concat(n);Z(e.definition,o=>{let s=new rt({definition:[o]});this.walk(s,i)})}};function dA(t,e,r){return[new Ue({definition:[new Re({terminalType:t.separator})].concat(t.definition)})].concat(e,r)}function Bo(t){if(t instanceof Fe)return Bo(t.referencedRule);if(t instanceof Re)return IV(t);if(LT(t))return NV(t);if(kT(t))return EV(t);throw Error("non exhaustive match")}function NV(t){let e=[],r=t.definition,n=0,i=r.length>n,o,s=!0;for(;i&&s;)o=r[n],s=Vo(o),e=e.concat(Bo(o)),n=n+1,i=r.length>n;return Ra(e)}function EV(t){let e=K(t.definition,r=>Bo(r));return Ra(Wt(e))}function IV(t){return[t.terminalType]}var ad="_~IN~_";var wT=class extends pi{constructor(e){super(),this.topProd=e,this.follows={}}startWalking(){return this.walk(this.topProd),this.follows}walkTerminal(e,r,n){}walkProdRef(e,r,n){let i=OV(e.referencedRule,e.idx)+this.topProd.name,o=r.concat(n),s=new rt({definition:o}),a=Bo(s);this.follows[i]=a}};function pA(t){let e={};return Z(t,r=>{let n=new wT(r).startWalking();fr(e,n)}),e}function OV(t,e){return t.name+e+ad}var ld={},AV=new Lo;function Ea(t){let e=t.toString();if(ld.hasOwnProperty(e))return ld[e];{let r=AV.pattern(e);return ld[e]=r,r}}function mA(){ld={}}var gA="Complement Sets are not supported for first char optimization",Wl=`Unable to use "first char" lexer optimizations:
`;function TA(t,e=!1){try{let r=Ea(t);return $T(r.value,{},r.flags.ignoreCase)}catch(r){if(r.message===gA)e&&Ul(`${Wl}	Unable to optimize: < ${t.toString()} >
	Complement Sets cannot be automatically optimized.
	This will disable the lexer's first char optimizations.
	See: https://chevrotain.io/docs/guide/resolving_lexer_errors.html#COMPLEMENT for details.`);else{let n="";e&&(n=`
	This will disable the lexer's first char optimizations.
	See: https://chevrotain.io/docs/guide/resolving_lexer_errors.html#REGEXP_PARSING for details.`),xa(`${Wl}
	Failed parsing: < ${t.toString()} >
	Using the @chevrotain/regexp-to-ast library
	Please open an issue at: https://github.com/chevrotain/chevrotain/issues`+n)}}return[]}function $T(t,e,r){switch(t.type){case"Disjunction":for(let i=0;i<t.value.length;i++)$T(t.value[i],e,r);break;case"Alternative":let n=t.value;for(let i=0;i<n.length;i++){let o=n[i];switch(o.type){case"EndAnchor":case"GroupBackReference":case"Lookahead":case"NegativeLookahead":case"StartAnchor":case"WordBoundary":case"NonWordBoundary":continue}let s=o;switch(s.type){case"Character":ud(s.value,e,r);break;case"Set":if(s.complement===!0)throw Error(gA);Z(s.value,l=>{if(typeof l=="number")ud(l,e,r);else{let u=l;if(r===!0)for(let c=u.from;c<=u.to;c++)ud(c,e,r);else{for(let c=u.from;c<=u.to&&c<Ia;c++)ud(c,e,r);if(u.to>=Ia){let c=u.from>=Ia?u.from:Ia,f=u.to,d=Xn(c),m=Xn(f);for(let _=d;_<=m;_++)e[_]=_}}}});break;case"Group":$T(s.value,e,r);break;default:throw Error("Non Exhaustive Match")}let a=s.quantifier!==void 0&&s.quantifier.atLeast===0;if(s.type==="Group"&&PT(s)===!1||s.type!=="Group"&&a===!1)break}break;default:throw Error("non exhaustive match!")}return We(e)}function ud(t,e,r){let n=Xn(t);e[n]=n,r===!0&&SV(t,e)}function SV(t,e){let r=String.fromCharCode(t),n=r.toUpperCase();if(n!==r){let i=Xn(n.charCodeAt(0));e[i]=i}else{let i=r.toLowerCase();if(i!==r){let o=Xn(i.charCodeAt(0));e[o]=o}}}function hA(t,e){return Yn(t.value,r=>{if(typeof r=="number")return dt(e,r);{let n=r;return Yn(e,i=>n.from<=i&&i<=n.to)!==void 0}})}function PT(t){let e=t.quantifier;return e&&e.atLeast===0?!0:t.value?se(t.value)?Rr(t.value,PT):PT(t.value):!1}var MT=class extends Fn{constructor(e){super(),this.targetCharCodes=e,this.found=!1}visitChildren(e){if(this.found!==!0){switch(e.type){case"Lookahead":this.visitLookahead(e);return;case"NegativeLookahead":this.visitNegativeLookahead(e);return}super.visitChildren(e)}}visitCharacter(e){dt(this.targetCharCodes,e.value)&&(this.found=!0)}visitSet(e){e.complement?hA(e,this.targetCharCodes)===void 0&&(this.found=!0):hA(e,this.targetCharCodes)!==void 0&&(this.found=!0)}};function cd(t,e){if(e instanceof RegExp){let r=Ea(e),n=new MT(t);return n.visit(r),n.found}else return Yn(e,r=>dt(t,r.charCodeAt(0)))!==void 0}var Wo="PATTERN",Oa="defaultMode",fd="modes",UT=typeof new RegExp("(?:)").sticky=="boolean";function vA(t,e){e=va(e,{useSticky:UT,debug:!1,safeMode:!1,positionTracking:"full",lineTerminatorCharacters:["\r",`
`],tracer:(y,g)=>g()});let r=e.tracer;r("initCharCodeToOptimizedIndexMap",()=>{HV()});let n;r("Reject Lexer.NA",()=>{n=oo(t,y=>y[Wo]===kt.NA)});let i=!1,o;r("Transform Patterns",()=>{i=!1,o=K(n,y=>{let g=y[Wo];if(mn(g)){let O=g.source;return O.length===1&&O!=="^"&&O!=="$"&&O!=="."&&!g.ignoreCase?O:O.length===2&&O[0]==="\\"&&!dt(["d","D","s","S","t","r","n","t","0","c","b","B","f","v","w","W"],O[1])?O[1]:e.useSticky?_A(g):yA(g)}else{if(Cr(g))return i=!0,{exec:g};if(typeof g=="object")return i=!0,g;if(typeof g=="string"){if(g.length===1)return g;{let O=g.replace(/[\\^$.*+?()[\]{}|]/g,"\\$&"),M=new RegExp(O);return e.useSticky?_A(M):yA(M)}}else throw Error("non exhaustive match")}})});let s,a,l,u,c;r("misc mapping",()=>{s=K(n,y=>y.tokenTypeIdx),a=K(n,y=>{let g=y.GROUP;if(g!==kt.SKIPPED){if(Zt(g))return g;if(xr(g))return!1;throw Error("non exhaustive match")}}),l=K(n,y=>{let g=y.LONGER_ALT;if(g)return se(g)?K(g,M=>id(n,M)):[id(n,g)]}),u=K(n,y=>y.PUSH_MODE),c=K(n,y=>te(y,"POP_MODE"))});let f;r("Line Terminator Handling",()=>{let y=SA(e.lineTerminatorCharacters);f=K(n,g=>!1),e.positionTracking!=="onlyOffset"&&(f=K(n,g=>te(g,"LINE_BREAKS")?!!g.LINE_BREAKS:AA(g,y)===!1&&cd(y,g.PATTERN)))});let d,m,_,x;r("Misc Mapping #2",()=>{d=K(n,IA),m=K(o,jV),_=It(n,(y,g)=>{let O=g.GROUP;return Zt(O)&&O!==kt.SKIPPED&&(y[O]=[]),y},{}),x=K(o,(y,g)=>({pattern:o[g],longerAlt:l[g],canLineTerminator:f[g],isCustom:d[g],short:m[g],group:a[g],push:u[g],pop:c[g],tokenTypeIdx:s[g],tokenType:n[g]}))});let A=!0,I=[];return e.safeMode||r("First Char Optimization",()=>{I=It(n,(y,g,O)=>{if(typeof g.PATTERN=="string"){let M=g.PATTERN.charCodeAt(0),J=Xn(M);FT(y,J,x[O])}else if(se(g.START_CHARS_HINT)){let M;Z(g.START_CHARS_HINT,J=>{let ce=typeof J=="string"?J.charCodeAt(0):J,_e=Xn(ce);M!==_e&&(M=_e,FT(y,_e,x[O]))})}else if(mn(g.PATTERN))if(g.PATTERN.unicode)A=!1,e.ensureOptimizations&&xa(`${Wl}	Unable to analyze < ${g.PATTERN.toString()} > pattern.
	The regexp unicode flag is not currently supported by the regexp-to-ast library.
	This will disable the lexer's first char optimizations.
	For details See: https://chevrotain.io/docs/guide/resolving_lexer_errors.html#UNICODE_OPTIMIZE`);else{let M=TA(g.PATTERN,e.ensureOptimizations);ve(M)&&(A=!1),Z(M,J=>{FT(y,J,x[O])})}else e.ensureOptimizations&&xa(`${Wl}	TokenType: <${g.name}> is using a custom token pattern without providing <start_chars_hint> parameter.
	This will disable the lexer's first char optimizations.
	For details See: https://chevrotain.io/docs/guide/resolving_lexer_errors.html#CUSTOM_OPTIMIZE`),A=!1;return y},[])}),{emptyGroups:_,patternIdxToConfig:x,charCodeToPatternIdxToConfig:I,hasCustom:i,canBeOptimized:A}}function RA(t,e){let r=[],n=CV(t);r=r.concat(n.errors);let i=bV(n.valid),o=i.valid;return r=r.concat(i.errors),r=r.concat(DV(o)),r=r.concat(UV(o)),r=r.concat(VV(o,e)),r=r.concat(BV(o)),r}function DV(t){let e=[],r=ir(t,n=>mn(n[Wo]));return e=e.concat(kV(r)),e=e.concat(PV(r)),e=e.concat(MV(r)),e=e.concat(FV(r)),e=e.concat(wV(r)),e}function CV(t){let e=ir(t,i=>!te(i,Wo)),r=K(e,i=>({message:"Token Type: ->"+i.name+"<- missing static 'PATTERN' property",type:pt.MISSING_PATTERN,tokenTypes:[i]})),n=io(t,e);return{errors:r,valid:n}}function bV(t){let e=ir(t,i=>{let o=i[Wo];return!mn(o)&&!Cr(o)&&!te(o,"exec")&&!Zt(o)}),r=K(e,i=>({message:"Token Type: ->"+i.name+"<- static 'PATTERN' can only be a RegExp, a Function matching the {CustomPatternMatcherFunc} type or an Object matching the {ICustomPattern} interface.",type:pt.INVALID_PATTERN,tokenTypes:[i]})),n=io(t,e);return{errors:r,valid:n}}var LV=/[^\\][$]/;function kV(t){class e extends Fn{constructor(){super(...arguments),this.found=!1}visitEndAnchor(o){this.found=!0}}let r=ir(t,i=>{let o=i.PATTERN;try{let s=Ea(o),a=new e;return a.visit(s),a.found}catch{return LV.test(o.source)}});return K(r,i=>({message:`Unexpected RegExp Anchor Error:
	Token Type: ->`+i.name+`<- static 'PATTERN' cannot contain end of input anchor '$'
	See chevrotain.io/docs/guide/resolving_lexer_errors.html#ANCHORS	for details.`,type:pt.EOI_ANCHOR_FOUND,tokenTypes:[i]}))}function wV(t){let e=ir(t,n=>n.PATTERN.test(""));return K(e,n=>({message:"Token Type: ->"+n.name+"<- static 'PATTERN' must not match an empty string",type:pt.EMPTY_MATCH_PATTERN,tokenTypes:[n]}))}var $V=/[^\\[][\^]|^\^/;function PV(t){class e extends Fn{constructor(){super(...arguments),this.found=!1}visitStartAnchor(o){this.found=!0}}let r=ir(t,i=>{let o=i.PATTERN;try{let s=Ea(o),a=new e;return a.visit(s),a.found}catch{return $V.test(o.source)}});return K(r,i=>({message:`Unexpected RegExp Anchor Error:
	Token Type: ->`+i.name+`<- static 'PATTERN' cannot contain start of input anchor '^'
	See https://chevrotain.io/docs/guide/resolving_lexer_errors.html#ANCHORS	for details.`,type:pt.SOI_ANCHOR_FOUND,tokenTypes:[i]}))}function MV(t){let e=ir(t,n=>{let i=n[Wo];return i instanceof RegExp&&(i.multiline||i.global)});return K(e,n=>({message:"Token Type: ->"+n.name+"<- static 'PATTERN' may NOT contain global('g') or multiline('m')",type:pt.UNSUPPORTED_FLAGS_FOUND,tokenTypes:[n]}))}function FV(t){let e=[],r=K(t,o=>It(t,(s,a)=>(o.PATTERN.source===a.PATTERN.source&&!dt(e,a)&&a.PATTERN!==kt.NA&&(e.push(a),s.push(a)),s),[]));r=Kn(r);let n=ir(r,o=>o.length>1);return K(n,o=>{let s=K(o,l=>l.name);return{message:`The same RegExp pattern ->${or(o).PATTERN}<-has been used in all of the following Token Types: ${s.join(", ")} <-`,type:pt.DUPLICATE_PATTERNS_FOUND,tokenTypes:o}})}function UV(t){let e=ir(t,n=>{if(!te(n,"GROUP"))return!1;let i=n.GROUP;return i!==kt.SKIPPED&&i!==kt.NA&&!Zt(i)});return K(e,n=>({message:"Token Type: ->"+n.name+"<- static 'GROUP' can only be Lexer.SKIPPED/Lexer.NA/A String",type:pt.INVALID_GROUP_TYPE_FOUND,tokenTypes:[n]}))}function VV(t,e){let r=ir(t,i=>i.PUSH_MODE!==void 0&&!dt(e,i.PUSH_MODE));return K(r,i=>({message:`Token Type: ->${i.name}<- static 'PUSH_MODE' value cannot refer to a Lexer Mode ->${i.PUSH_MODE}<-which does not exist`,type:pt.PUSH_MODE_DOES_NOT_EXIST,tokenTypes:[i]}))}function BV(t){let e=[],r=It(t,(n,i,o)=>{let s=i.PATTERN;return s===kt.NA||(Zt(s)?n.push({str:s,idx:o,tokenType:i}):mn(s)&&GV(s)&&n.push({str:s.source,idx:o,tokenType:i})),n},[]);return Z(t,(n,i)=>{Z(r,({str:o,idx:s,tokenType:a})=>{if(i<s&&WV(o,n.PATTERN)){let l=`Token: ->${a.name}<- can never be matched.
Because it appears AFTER the Token Type ->${n.name}<-in the lexer's definition.
See https://chevrotain.io/docs/guide/resolving_lexer_errors.html#UNREACHABLE`;e.push({message:l,type:pt.UNREACHABLE_PATTERN,tokenTypes:[n,a]})}})}),e}function WV(t,e){if(mn(e)){let r=e.exec(t);return r!==null&&r.index===0}else{if(Cr(e))return e(t,0,[],{});if(te(e,"exec"))return e.exec(t,0,[],{});if(typeof e=="string")return e===t;throw Error("non exhaustive match")}}function GV(t){return Yn([".","\\","[","]","|","^","$","(",")","?","*","+","{"],r=>t.source.indexOf(r)!==-1)===void 0}function yA(t){let e=t.ignoreCase?"i":"";return new RegExp(`^(?:${t.source})`,e)}function _A(t){let e=t.ignoreCase?"iy":"y";return new RegExp(`${t.source}`,e)}function xA(t,e,r){let n=[];return te(t,Oa)||n.push({message:"A MultiMode Lexer cannot be initialized without a <"+Oa+`> property in its definition
`,type:pt.MULTI_MODE_LEXER_WITHOUT_DEFAULT_MODE}),te(t,fd)||n.push({message:"A MultiMode Lexer cannot be initialized without a <"+fd+`> property in its definition
`,type:pt.MULTI_MODE_LEXER_WITHOUT_MODES_PROPERTY}),te(t,fd)&&te(t,Oa)&&!te(t.modes,t.defaultMode)&&n.push({message:`A MultiMode Lexer cannot be initialized with a ${Oa}: <${t.defaultMode}>which does not exist
`,type:pt.MULTI_MODE_LEXER_DEFAULT_MODE_VALUE_DOES_NOT_EXIST}),te(t,fd)&&Z(t.modes,(i,o)=>{Z(i,(s,a)=>{if(xr(s))n.push({message:`A Lexer cannot be initialized using an undefined Token Type. Mode:<${o}> at index: <${a}>
`,type:pt.LEXER_DEFINITION_CANNOT_CONTAIN_UNDEFINED});else if(te(s,"LONGER_ALT")){let l=se(s.LONGER_ALT)?s.LONGER_ALT:[s.LONGER_ALT];Z(l,u=>{!xr(u)&&!dt(i,u)&&n.push({message:`A MultiMode Lexer cannot be initialized with a longer_alt <${u.name}> on token <${s.name}> outside of mode <${o}>
`,type:pt.MULTI_MODE_LEXER_LONGER_ALT_NOT_IN_CURRENT_MODE})})}})}),n}function NA(t,e,r){let n=[],i=!1,o=Kn(Wt(We(t.modes))),s=oo(o,l=>l[Wo]===kt.NA),a=SA(r);return e&&Z(s,l=>{let u=AA(l,a);if(u!==!1){let f={message:qV(l,u),type:u.issue,tokenType:l};n.push(f)}else te(l,"LINE_BREAKS")?l.LINE_BREAKS===!0&&(i=!0):cd(a,l.PATTERN)&&(i=!0)}),e&&!i&&n.push({message:`Warning: No LINE_BREAKS Found.
	This Lexer has been defined to track line and column information,
	But none of the Token Types can be identified as matching a line terminator.
	See https://chevrotain.io/docs/guide/resolving_lexer_errors.html#LINE_BREAKS 
	for details.`,type:pt.NO_LINE_BREAKS_FLAGS}),n}function EA(t){let e={},r=Ze(t);return Z(r,n=>{let i=t[n];if(se(i))e[n]=[];else throw Error("non exhaustive match")}),e}function IA(t){let e=t.PATTERN;if(mn(e))return!1;if(Cr(e))return!0;if(te(e,"exec"))return!0;if(Zt(e))return!1;throw Error("non exhaustive match")}function jV(t){return Zt(t)&&t.length===1?t.charCodeAt(0):!1}var OA={test:function(t){let e=t.length;for(let r=this.lastIndex;r<e;r++){let n=t.charCodeAt(r);if(n===10)return this.lastIndex=r+1,!0;if(n===13)return t.charCodeAt(r+1)===10?this.lastIndex=r+2:this.lastIndex=r+1,!0}return!1},lastIndex:0};function AA(t,e){if(te(t,"LINE_BREAKS"))return!1;if(mn(t.PATTERN)){try{cd(e,t.PATTERN)}catch(r){return{issue:pt.IDENTIFY_TERMINATOR,errMsg:r.message}}return!1}else{if(Zt(t.PATTERN))return!1;if(IA(t))return{issue:pt.CUSTOM_LINE_BREAK};throw Error("non exhaustive match")}}function qV(t,e){if(e.issue===pt.IDENTIFY_TERMINATOR)return`Warning: unable to identify line terminator usage in pattern.
	The problem is in the <${t.name}> Token Type
	 Root cause: ${e.errMsg}.
	For details See: https://chevrotain.io/docs/guide/resolving_lexer_errors.html#IDENTIFY_TERMINATOR`;if(e.issue===pt.CUSTOM_LINE_BREAK)return`Warning: A Custom Token Pattern should specify the <line_breaks> option.
	The problem is in the <${t.name}> Token Type
	For details See: https://chevrotain.io/docs/guide/resolving_lexer_errors.html#CUSTOM_LINE_BREAK`;throw Error("non exhaustive match")}function SA(t){return K(t,r=>Zt(r)?r.charCodeAt(0):r)}function FT(t,e,r){t[e]===void 0?t[e]=[r]:t[e].push(r)}var Ia=256,dd=[];function Xn(t){return t<Ia?t:dd[t]}function HV(){if(ve(dd)){dd=new Array(65536);for(let t=0;t<65536;t++)dd[t]=t>255?255+~~(t/255):t}}function mi(t,e){let r=t.tokenTypeIdx;return r===e.tokenTypeIdx?!0:e.isParent===!0&&e.categoryMatchesMap[r]===!0}function Aa(t,e){return t.tokenTypeIdx===e.tokenTypeIdx}var DA=1,bA={};function hi(t){let e=KV(t);zV(e),XV(e),YV(e),Z(e,r=>{r.isParent=r.categoryMatches.length>0})}function KV(t){let e=tt(t),r=t,n=!0;for(;n;){r=Kn(Wt(K(r,o=>o.CATEGORIES)));let i=io(r,e);e=e.concat(i),ve(i)?n=!1:r=i}return e}function zV(t){Z(t,e=>{VT(e)||(bA[DA]=e,e.tokenTypeIdx=DA++),CA(e)&&!se(e.CATEGORIES)&&(e.CATEGORIES=[e.CATEGORIES]),CA(e)||(e.CATEGORIES=[]),JV(e)||(e.categoryMatches=[]),QV(e)||(e.categoryMatchesMap={})})}function YV(t){Z(t,e=>{e.categoryMatches=[],Z(e.categoryMatchesMap,(r,n)=>{e.categoryMatches.push(bA[n].tokenTypeIdx)})})}function XV(t){Z(t,e=>{LA([],e)})}function LA(t,e){Z(t,r=>{e.categoryMatchesMap[r.tokenTypeIdx]=!0}),Z(e.CATEGORIES,r=>{let n=t.concat(e);dt(n,r)||LA(n,r)})}function VT(t){return te(t,"tokenTypeIdx")}function CA(t){return te(t,"CATEGORIES")}function JV(t){return te(t,"categoryMatches")}function QV(t){return te(t,"categoryMatchesMap")}function kA(t){return te(t,"tokenTypeIdx")}var BT={buildUnableToPopLexerModeMessage(t){return`Unable to pop Lexer Mode after encountering Token ->${t.image}<- The Mode Stack is empty`},buildUnexpectedCharactersMessage(t,e,r,n,i){return`unexpected character: ->${t.charAt(e)}<- at offset: ${e}, skipped ${r} characters.`}};var pt;(function(t){t[t.MISSING_PATTERN=0]="MISSING_PATTERN",t[t.INVALID_PATTERN=1]="INVALID_PATTERN",t[t.EOI_ANCHOR_FOUND=2]="EOI_ANCHOR_FOUND",t[t.UNSUPPORTED_FLAGS_FOUND=3]="UNSUPPORTED_FLAGS_FOUND",t[t.DUPLICATE_PATTERNS_FOUND=4]="DUPLICATE_PATTERNS_FOUND",t[t.INVALID_GROUP_TYPE_FOUND=5]="INVALID_GROUP_TYPE_FOUND",t[t.PUSH_MODE_DOES_NOT_EXIST=6]="PUSH_MODE_DOES_NOT_EXIST",t[t.MULTI_MODE_LEXER_WITHOUT_DEFAULT_MODE=7]="MULTI_MODE_LEXER_WITHOUT_DEFAULT_MODE",t[t.MULTI_MODE_LEXER_WITHOUT_MODES_PROPERTY=8]="MULTI_MODE_LEXER_WITHOUT_MODES_PROPERTY",t[t.MULTI_MODE_LEXER_DEFAULT_MODE_VALUE_DOES_NOT_EXIST=9]="MULTI_MODE_LEXER_DEFAULT_MODE_VALUE_DOES_NOT_EXIST",t[t.LEXER_DEFINITION_CANNOT_CONTAIN_UNDEFINED=10]="LEXER_DEFINITION_CANNOT_CONTAIN_UNDEFINED",t[t.SOI_ANCHOR_FOUND=11]="SOI_ANCHOR_FOUND",t[t.EMPTY_MATCH_PATTERN=12]="EMPTY_MATCH_PATTERN",t[t.NO_LINE_BREAKS_FLAGS=13]="NO_LINE_BREAKS_FLAGS",t[t.UNREACHABLE_PATTERN=14]="UNREACHABLE_PATTERN",t[t.IDENTIFY_TERMINATOR=15]="IDENTIFY_TERMINATOR",t[t.CUSTOM_LINE_BREAK=16]="CUSTOM_LINE_BREAK",t[t.MULTI_MODE_LEXER_LONGER_ALT_NOT_IN_CURRENT_MODE=17]="MULTI_MODE_LEXER_LONGER_ALT_NOT_IN_CURRENT_MODE"})(pt||(pt={}));var Gl={deferDefinitionErrorsHandling:!1,positionTracking:"full",lineTerminatorsPattern:/\n|\r\n?/g,lineTerminatorCharacters:[`
`,"\r"],ensureOptimizations:!1,safeMode:!1,errorMessageProvider:BT,traceInitPerf:!1,skipValidations:!1,recoveryEnabled:!0};Object.freeze(Gl);var kt=class{constructor(e,r=Gl){if(this.lexerDefinition=e,this.lexerDefinitionErrors=[],this.lexerDefinitionWarning=[],this.patternIdxToConfig={},this.charCodeToPatternIdxToConfig={},this.modes=[],this.emptyGroups={},this.trackStartLines=!0,this.trackEndLines=!0,this.hasCustom=!1,this.canModeBeOptimized={},this.TRACE_INIT=(i,o)=>{if(this.traceInitPerf===!0){this.traceInitIndent++;let s=new Array(this.traceInitIndent+1).join("	");this.traceInitIndent<this.traceInitMaxIdent&&console.log(`${s}--> <${i}>`);let{time:a,value:l}=Vl(o),u=a>10?console.warn:console.log;return this.traceInitIndent<this.traceInitMaxIdent&&u(`${s}<-- <${i}> time: ${a}ms`),this.traceInitIndent--,l}else return o()},typeof r=="boolean")throw Error(`The second argument to the Lexer constructor is now an ILexerConfig Object.
a boolean 2nd argument is no longer supported`);this.config=fr({},Gl,r);let n=this.config.traceInitPerf;n===!0?(this.traceInitMaxIdent=1/0,this.traceInitPerf=!0):typeof n=="number"&&(this.traceInitMaxIdent=n,this.traceInitPerf=!0),this.traceInitIndent=-1,this.TRACE_INIT("Lexer Constructor",()=>{let i,o=!0;this.TRACE_INIT("Lexer Config handling",()=>{if(this.config.lineTerminatorsPattern===Gl.lineTerminatorsPattern)this.config.lineTerminatorsPattern=OA;else if(this.config.lineTerminatorCharacters===Gl.lineTerminatorCharacters)throw Error(`Error: Missing <lineTerminatorCharacters> property on the Lexer config.
	For details See: https://chevrotain.io/docs/guide/resolving_lexer_errors.html#MISSING_LINE_TERM_CHARS`);if(r.safeMode&&r.ensureOptimizations)throw Error('"safeMode" and "ensureOptimizations" flags are mutually exclusive.');this.trackStartLines=/full|onlyStart/i.test(this.config.positionTracking),this.trackEndLines=/full/i.test(this.config.positionTracking),se(e)?i={modes:{defaultMode:tt(e)},defaultMode:Oa}:(o=!1,i=tt(e))}),this.config.skipValidations===!1&&(this.TRACE_INIT("performRuntimeChecks",()=>{this.lexerDefinitionErrors=this.lexerDefinitionErrors.concat(xA(i,this.trackStartLines,this.config.lineTerminatorCharacters))}),this.TRACE_INIT("performWarningRuntimeChecks",()=>{this.lexerDefinitionWarning=this.lexerDefinitionWarning.concat(NA(i,this.trackStartLines,this.config.lineTerminatorCharacters))})),i.modes=i.modes?i.modes:{},Z(i.modes,(a,l)=>{i.modes[l]=oo(a,u=>xr(u))});let s=Ze(i.modes);if(Z(i.modes,(a,l)=>{this.TRACE_INIT(`Mode: <${l}> processing`,()=>{if(this.modes.push(l),this.config.skipValidations===!1&&this.TRACE_INIT("validatePatterns",()=>{this.lexerDefinitionErrors=this.lexerDefinitionErrors.concat(RA(a,s))}),ve(this.lexerDefinitionErrors)){hi(a);let u;this.TRACE_INIT("analyzeTokenTypes",()=>{u=vA(a,{lineTerminatorCharacters:this.config.lineTerminatorCharacters,positionTracking:r.positionTracking,ensureOptimizations:r.ensureOptimizations,safeMode:r.safeMode,tracer:this.TRACE_INIT})}),this.patternIdxToConfig[l]=u.patternIdxToConfig,this.charCodeToPatternIdxToConfig[l]=u.charCodeToPatternIdxToConfig,this.emptyGroups=fr({},this.emptyGroups,u.emptyGroups),this.hasCustom=u.hasCustom||this.hasCustom,this.canModeBeOptimized[l]=u.canBeOptimized}})}),this.defaultMode=i.defaultMode,!ve(this.lexerDefinitionErrors)&&!this.config.deferDefinitionErrorsHandling){let l=K(this.lexerDefinitionErrors,u=>u.message).join(`-----------------------
`);throw new Error(`Errors detected in definition of Lexer:
`+l)}Z(this.lexerDefinitionWarning,a=>{Ul(a.message)}),this.TRACE_INIT("Choosing sub-methods implementations",()=>{if(UT?(this.chopInput=Hr,this.match=this.matchWithTest):(this.updateLastIndex=Et,this.match=this.matchWithExec),o&&(this.handleModes=Et),this.trackStartLines===!1&&(this.computeNewColumn=Hr),this.trackEndLines===!1&&(this.updateTokenEndLineColumnLocation=Et),/full/i.test(this.config.positionTracking))this.createTokenInstance=this.createFullToken;else if(/onlyStart/i.test(this.config.positionTracking))this.createTokenInstance=this.createStartOnlyToken;else if(/onlyOffset/i.test(this.config.positionTracking))this.createTokenInstance=this.createOffsetOnlyToken;else throw Error(`Invalid <positionTracking> config option: "${this.config.positionTracking}"`);this.hasCustom?(this.addToken=this.addTokenUsingPush,this.handlePayload=this.handlePayloadWithCustom):(this.addToken=this.addTokenUsingMemberAccess,this.handlePayload=this.handlePayloadNoCustom)}),this.TRACE_INIT("Failed Optimization Warnings",()=>{let a=It(this.canModeBeOptimized,(l,u,c)=>(u===!1&&l.push(c),l),[]);if(r.ensureOptimizations&&!ve(a))throw Error(`Lexer Modes: < ${a.join(", ")} > cannot be optimized.
	 Disable the "ensureOptimizations" lexer config flag to silently ignore this and run the lexer in an un-optimized mode.
	 Or inspect the console log for details on how to resolve these issues.`)}),this.TRACE_INIT("clearRegExpParserCache",()=>{mA()}),this.TRACE_INIT("toFastProperties",()=>{Bl(this)})})}tokenize(e,r=this.defaultMode){if(!ve(this.lexerDefinitionErrors)){let i=K(this.lexerDefinitionErrors,o=>o.message).join(`-----------------------
`);throw new Error(`Unable to Tokenize because Errors detected in definition of Lexer:
`+i)}return this.tokenizeInternal(e,r)}tokenizeInternal(e,r){let n,i,o,s,a,l,u,c,f,d,m,_,x,A,I,y,g=e,O=g.length,M=0,J=0,ce=this.hasCustom?0:Math.floor(e.length/10),_e=new Array(ce),je=[],Ce=this.trackStartLines?1:void 0,j=this.trackStartLines?1:void 0,k=EA(this.emptyGroups),V=this.trackStartLines,G=this.config.lineTerminatorsPattern,ie=0,z=[],$=[],w=[],le=[];Object.freeze(le);let he;function Se(){return z}function ar(ht){let Jt=Xn(ht),Pt=$[Jt];return Pt===void 0?le:Pt}let Ii=ht=>{if(w.length===1&&ht.tokenType.PUSH_MODE===void 0){let Jt=this.config.errorMessageProvider.buildUnableToPopLexerModeMessage(ht);je.push({offset:ht.startOffset,line:ht.startLine,column:ht.startColumn,length:ht.image.length,message:Jt})}else{w.pop();let Jt=zn(w);z=this.patternIdxToConfig[Jt],$=this.charCodeToPatternIdxToConfig[Jt],ie=z.length;let Pt=this.canModeBeOptimized[Jt]&&this.config.safeMode===!1;$&&Pt?he=ar:he=Se}};function qe(ht){w.push(ht),$=this.charCodeToPatternIdxToConfig[ht],z=this.patternIdxToConfig[ht],ie=z.length,ie=z.length;let Jt=this.canModeBeOptimized[ht]&&this.config.safeMode===!1;$&&Jt?he=ar:he=Se}qe.call(this,r);let Xt,ti=this.config.recoveryEnabled;for(;M<O;){l=null;let ht=g.charCodeAt(M),Jt=he(ht),Pt=Jt.length;for(n=0;n<Pt;n++){Xt=Jt[n];let Mt=Xt.pattern;u=null;let gt=Xt.short;if(gt!==!1?ht===gt&&(l=Mt):Xt.isCustom===!0?(y=Mt.exec(g,M,_e,k),y!==null?(l=y[0],y.payload!==void 0&&(u=y.payload)):l=null):(this.updateLastIndex(Mt,M),l=this.match(Mt,e,M)),l!==null){if(a=Xt.longerAlt,a!==void 0){let Tt=a.length;for(o=0;o<Tt;o++){let hr=z[a[o]],Ir=hr.pattern;if(c=null,hr.isCustom===!0?(y=Ir.exec(g,M,_e,k),y!==null?(s=y[0],y.payload!==void 0&&(c=y.payload)):s=null):(this.updateLastIndex(Ir,M),s=this.match(Ir,e,M)),s&&s.length>l.length){l=s,u=c,Xt=hr;break}}}break}}if(l!==null){if(f=l.length,d=Xt.group,d!==void 0&&(m=Xt.tokenTypeIdx,_=this.createTokenInstance(l,M,m,Xt.tokenType,Ce,j,f),this.handlePayload(_,u),d===!1?J=this.addToken(_e,J,_):k[d].push(_)),e=this.chopInput(e,f),M=M+f,j=this.computeNewColumn(j,f),V===!0&&Xt.canLineTerminator===!0){let Mt=0,gt,Tt;G.lastIndex=0;do gt=G.test(l),gt===!0&&(Tt=G.lastIndex-1,Mt++);while(gt===!0);Mt!==0&&(Ce=Ce+Mt,j=f-Tt,this.updateTokenEndLineColumnLocation(_,d,Tt,Mt,Ce,j,f))}this.handleModes(Xt,Ii,qe,_)}else{let Mt=M,gt=Ce,Tt=j,hr=ti===!1;for(;hr===!1&&M<O;)for(e=this.chopInput(e,1),M++,i=0;i<ie;i++){let Ir=z[i],Jr=Ir.pattern,ri=Ir.short;if(ri!==!1?g.charCodeAt(M)===ri&&(hr=!0):Ir.isCustom===!0?hr=Jr.exec(g,M,_e,k)!==null:(this.updateLastIndex(Jr,M),hr=Jr.exec(e)!==null),hr===!0)break}if(x=M-Mt,j=this.computeNewColumn(j,x),I=this.config.errorMessageProvider.buildUnexpectedCharactersMessage(g,Mt,x,gt,Tt),je.push({offset:Mt,line:gt,column:Tt,length:x,message:I}),ti===!1)break}}return this.hasCustom||(_e.length=J),{tokens:_e,groups:k,errors:je}}handleModes(e,r,n,i){if(e.pop===!0){let o=e.push;r(i),o!==void 0&&n.call(this,o)}else e.push!==void 0&&n.call(this,e.push)}chopInput(e,r){return e.substring(r)}updateLastIndex(e,r){e.lastIndex=r}updateTokenEndLineColumnLocation(e,r,n,i,o,s,a){let l,u;r!==void 0&&(l=n===a-1,u=l?-1:0,i===1&&l===!0||(e.endLine=o+u,e.endColumn=s-1+-u))}computeNewColumn(e,r){return e+r}createOffsetOnlyToken(e,r,n,i){return{image:e,startOffset:r,tokenTypeIdx:n,tokenType:i}}createStartOnlyToken(e,r,n,i,o,s){return{image:e,startOffset:r,startLine:o,startColumn:s,tokenTypeIdx:n,tokenType:i}}createFullToken(e,r,n,i,o,s,a){return{image:e,startOffset:r,endOffset:r+a-1,startLine:o,endLine:o,startColumn:s,endColumn:s+a-1,tokenTypeIdx:n,tokenType:i}}addTokenUsingPush(e,r,n){return e.push(n),r}addTokenUsingMemberAccess(e,r,n){return e[r]=n,r++,r}handlePayloadNoCustom(e,r){}handlePayloadWithCustom(e,r){r!==null&&(e.payload=r)}matchWithTest(e,r,n){return e.test(r)===!0?r.substring(n,e.lastIndex):null}matchWithExec(e,r){let n=e.exec(r);return n!==null?n[0]:null}};kt.SKIPPED="This marks a skipped Token pattern, this means each token identified by it willbe consumed and then thrown into oblivion, this can be used to for example to completely ignore whitespace.";kt.NA=/NOT_APPLICABLE/;function gi(t){return WT(t)?t.LABEL:t.name}function WT(t){return Zt(t.LABEL)&&t.LABEL!==""}var ZV="parent",wA="categories",$A="label",PA="group",MA="push_mode",FA="pop_mode",UA="longer_alt",VA="line_breaks",BA="start_chars_hint";function pd(t){return eB(t)}function eB(t){let e=t.pattern,r={};if(r.name=t.name,xr(e)||(r.PATTERN=e),te(t,ZV))throw`The parent property is no longer supported.
See: https://github.com/chevrotain/chevrotain/issues/564#issuecomment-349062346 for details.`;return te(t,wA)&&(r.CATEGORIES=t[wA]),hi([r]),te(t,$A)&&(r.LABEL=t[$A]),te(t,PA)&&(r.GROUP=t[PA]),te(t,FA)&&(r.POP_MODE=t[FA]),te(t,MA)&&(r.PUSH_MODE=t[MA]),te(t,UA)&&(r.LONGER_ALT=t[UA]),te(t,VA)&&(r.LINE_BREAKS=t[VA]),te(t,BA)&&(r.START_CHARS_HINT=t[BA]),r}var nn=pd({name:"EOF",pattern:kt.NA});hi([nn]);function Go(t,e,r,n,i,o,s,a){return{image:e,startOffset:r,endOffset:n,startLine:i,endLine:o,startColumn:s,endColumn:a,tokenTypeIdx:t.tokenTypeIdx,tokenType:t}}function jl(t,e){return mi(t,e)}var Ti={buildMismatchTokenMessage({expected:t,actual:e,previous:r,ruleName:n}){return`Expecting ${WT(t)?`--> ${gi(t)} <--`:`token of type --> ${t.name} <--`} but found --> '${e.image}' <--`},buildNotAllInputParsedMessage({firstRedundant:t,ruleName:e}){return"Redundant input, expecting EOF but found: "+t.image},buildNoViableAltMessage({expectedPathsPerAlt:t,actual:e,previous:r,customUserDescription:n,ruleName:i}){let o="Expecting: ",a=`
but found: '`+or(e).image+"'";if(n)return o+n+a;{let l=It(t,(d,m)=>d.concat(m),[]),u=K(l,d=>`[${K(d,m=>gi(m)).join(", ")}]`),f=`one of these possible Token sequences:
${K(u,(d,m)=>`  ${m+1}. ${d}`).join(`
`)}`;return o+f+a}},buildEarlyExitMessage({expectedIterationPaths:t,actual:e,customUserDescription:r,ruleName:n}){let i="Expecting: ",s=`
but found: '`+or(e).image+"'";if(r)return i+r+s;{let l=`expecting at least one iteration which starts with one of these possible Token sequences::
  <${K(t,u=>`[${K(u,c=>gi(c)).join(",")}]`).join(" ,")}>`;return i+l+s}}};Object.freeze(Ti);var WA={buildRuleNotFoundError(t,e){return"Invalid grammar, reference to a rule which is not defined: ->"+e.nonTerminalName+`<-
inside top level rule: ->`+t.name+"<-"}},Sn={buildDuplicateFoundError(t,e){function r(c){return c instanceof Re?c.terminalType.name:c instanceof Fe?c.nonTerminalName:""}let n=t.name,i=or(e),o=i.idx,s=Xr(i),a=r(i),l=o>0,u=`->${s}${l?o:""}<- ${a?`with argument: ->${a}<-`:""}
                  appears more than once (${e.length} times) in the top level rule: ->${n}<-.                  
                  For further details see: https://chevrotain.io/docs/FAQ.html#NUMERICAL_SUFFIXES 
                  `;return u=u.replace(/[ \t]+/g," "),u=u.replace(/\s\s+/g,`
`),u},buildNamespaceConflictError(t){return`Namespace conflict found in grammar.
The grammar has both a Terminal(Token) and a Non-Terminal(Rule) named: <${t.name}>.
To resolve this make sure each Terminal and Non-Terminal names are unique
This is easy to accomplish by using the convention that Terminal names start with an uppercase letter
and Non-Terminal names start with a lower case letter.`},buildAlternationPrefixAmbiguityError(t){let e=K(t.prefixPath,i=>gi(i)).join(", "),r=t.alternation.idx===0?"":t.alternation.idx;return`Ambiguous alternatives: <${t.ambiguityIndices.join(" ,")}> due to common lookahead prefix
in <OR${r}> inside <${t.topLevelRule.name}> Rule,
<${e}> may appears as a prefix path in all these alternatives.
See: https://chevrotain.io/docs/guide/resolving_grammar_errors.html#COMMON_PREFIX
For Further details.`},buildAlternationAmbiguityError(t){let e=K(t.prefixPath,i=>gi(i)).join(", "),r=t.alternation.idx===0?"":t.alternation.idx,n=`Ambiguous Alternatives Detected: <${t.ambiguityIndices.join(" ,")}> in <OR${r}> inside <${t.topLevelRule.name}> Rule,
<${e}> may appears as a prefix path in all these alternatives.
`;return n=n+`See: https://chevrotain.io/docs/guide/resolving_grammar_errors.html#AMBIGUOUS_ALTERNATIVES
For Further details.`,n},buildEmptyRepetitionError(t){let e=Xr(t.repetition);return t.repetition.idx!==0&&(e+=t.repetition.idx),`The repetition <${e}> within Rule <${t.topLevelRule.name}> can never consume any tokens.
This could lead to an infinite loop.`},buildTokenNameError(t){return"deprecated"},buildEmptyAlternationError(t){return`Ambiguous empty alternative: <${t.emptyChoiceIdx+1}> in <OR${t.alternation.idx}> inside <${t.topLevelRule.name}> Rule.
Only the last alternative may be an empty alternative.`},buildTooManyAlternativesError(t){return`An Alternation cannot have more than 256 alternatives:
<OR${t.alternation.idx}> inside <${t.topLevelRule.name}> Rule.
 has ${t.alternation.definition.length+1} alternatives.`},buildLeftRecursionError(t){let e=t.topLevelRule.name,r=K(t.leftRecursionPath,o=>o.name),n=`${e} --> ${r.concat([e]).join(" --> ")}`;return`Left Recursion found in grammar.
rule: <${e}> can be invoked from itself (directly or indirectly)
without consuming any Tokens. The grammar path that causes this is: 
 ${n}
 To fix this refactor your grammar to remove the left recursion.
see: https://en.wikipedia.org/wiki/LL_parser#Left_factoring.`},buildInvalidRuleNameError(t){return"deprecated"},buildDuplicateRuleNameError(t){let e;return t.topLevelRule instanceof br?e=t.topLevelRule.name:e=t.topLevelRule,`Duplicate definition, rule: ->${e}<- is already defined in the grammar: ->${t.grammarName}<-`}};function GA(t,e){let r=new GT(t,e);return r.resolveRefs(),r.errors}var GT=class extends Lr{constructor(e,r){super(),this.nameToTopRule=e,this.errMsgProvider=r,this.errors=[]}resolveRefs(){Z(We(this.nameToTopRule),e=>{this.currTopLevel=e,e.accept(this)})}visitNonTerminal(e){let r=this.nameToTopRule[e.nonTerminalName];if(r)e.referencedRule=r;else{let n=this.errMsgProvider.buildRuleNotFoundError(this.currTopLevel,e);this.errors.push({message:n,type:er.UNRESOLVED_SUBRULE_REF,ruleName:this.currTopLevel.name,unresolvedRefName:e.nonTerminalName})}}};var jT=class extends pi{constructor(e,r){super(),this.topProd=e,this.path=r,this.possibleTokTypes=[],this.nextProductionName="",this.nextProductionOccurrence=0,this.found=!1,this.isAtEndOfPath=!1}startWalking(){if(this.found=!1,this.path.ruleStack[0]!==this.topProd.name)throw Error("The path does not start with the walker's top Rule!");return this.ruleStack=tt(this.path.ruleStack).reverse(),this.occurrenceStack=tt(this.path.occurrenceStack).reverse(),this.ruleStack.pop(),this.occurrenceStack.pop(),this.updateExpectedNext(),this.walk(this.topProd),this.possibleTokTypes}walk(e,r=[]){this.found||super.walk(e,r)}walkProdRef(e,r,n){if(e.referencedRule.name===this.nextProductionName&&e.idx===this.nextProductionOccurrence){let i=r.concat(n);this.updateExpectedNext(),this.walk(e.referencedRule,i)}}updateExpectedNext(){ve(this.ruleStack)?(this.nextProductionName="",this.nextProductionOccurrence=0,this.isAtEndOfPath=!0):(this.nextProductionName=this.ruleStack.pop(),this.nextProductionOccurrence=this.occurrenceStack.pop())}},md=class extends jT{constructor(e,r){super(e,r),this.path=r,this.nextTerminalName="",this.nextTerminalOccurrence=0,this.nextTerminalName=this.path.lastTok.name,this.nextTerminalOccurrence=this.path.lastTokOccurrence}walkTerminal(e,r,n){if(this.isAtEndOfPath&&e.terminalType.name===this.nextTerminalName&&e.idx===this.nextTerminalOccurrence&&!this.found){let i=r.concat(n),o=new rt({definition:i});this.possibleTokTypes=Bo(o),this.found=!0}}},Sa=class extends pi{constructor(e,r){super(),this.topRule=e,this.occurrence=r,this.result={token:void 0,occurrence:void 0,isEndOfRule:void 0}}startWalking(){return this.walk(this.topRule),this.result}},hd=class extends Sa{walkMany(e,r,n){if(e.idx===this.occurrence){let i=or(r.concat(n));this.result.isEndOfRule=i===void 0,i instanceof Re&&(this.result.token=i.terminalType,this.result.occurrence=i.idx)}else super.walkMany(e,r,n)}},ql=class extends Sa{walkManySep(e,r,n){if(e.idx===this.occurrence){let i=or(r.concat(n));this.result.isEndOfRule=i===void 0,i instanceof Re&&(this.result.token=i.terminalType,this.result.occurrence=i.idx)}else super.walkManySep(e,r,n)}},gd=class extends Sa{walkAtLeastOne(e,r,n){if(e.idx===this.occurrence){let i=or(r.concat(n));this.result.isEndOfRule=i===void 0,i instanceof Re&&(this.result.token=i.terminalType,this.result.occurrence=i.idx)}else super.walkAtLeastOne(e,r,n)}},Hl=class extends Sa{walkAtLeastOneSep(e,r,n){if(e.idx===this.occurrence){let i=or(r.concat(n));this.result.isEndOfRule=i===void 0,i instanceof Re&&(this.result.token=i.terminalType,this.result.occurrence=i.idx)}else super.walkAtLeastOneSep(e,r,n)}};function Td(t,e,r=[]){r=tt(r);let n=[],i=0;function o(a){return a.concat(Gt(t,i+1))}function s(a){let l=Td(o(a),e,r);return n.concat(l)}for(;r.length<e&&i<t.length;){let a=t[i];if(a instanceof rt)return s(a.definition);if(a instanceof Fe)return s(a.definition);if(a instanceof Ue)n=s(a.definition);else if(a instanceof nt){let l=a.definition.concat([new Oe({definition:a.definition})]);return s(l)}else if(a instanceof it){let l=[new rt({definition:a.definition}),new Oe({definition:[new Re({terminalType:a.separator})].concat(a.definition)})];return s(l)}else if(a instanceof Ke){let l=a.definition.concat([new Oe({definition:[new Re({terminalType:a.separator})].concat(a.definition)})]);n=s(l)}else if(a instanceof Oe){let l=a.definition.concat([new Oe({definition:a.definition})]);n=s(l)}else{if(a instanceof ze)return Z(a.definition,l=>{ve(l.definition)===!1&&(n=s(l.definition))}),n;if(a instanceof Re)r.push(a.terminalType);else throw Error("non exhaustive match")}i++}return n.push({partialPath:r,suffixDef:Gt(t,i)}),n}function yd(t,e,r,n){let i="EXIT_NONE_TERMINAL",o=[i],s="EXIT_ALTERNATIVE",a=!1,l=e.length,u=l-n-1,c=[],f=[];for(f.push({idx:-1,def:t,ruleStack:[],occurrenceStack:[]});!ve(f);){let d=f.pop();if(d===s){a&&zn(f).idx<=u&&f.pop();continue}let m=d.def,_=d.idx,x=d.ruleStack,A=d.occurrenceStack;if(ve(m))continue;let I=m[0];if(I===i){let y={idx:_,def:Gt(m),ruleStack:di(x),occurrenceStack:di(A)};f.push(y)}else if(I instanceof Re)if(_<l-1){let y=_+1,g=e[y];if(r(g,I.terminalType)){let O={idx:y,def:Gt(m),ruleStack:x,occurrenceStack:A};f.push(O)}}else if(_===l-1)c.push({nextTokenType:I.terminalType,nextTokenOccurrence:I.idx,ruleStack:x,occurrenceStack:A}),a=!0;else throw Error("non exhaustive match");else if(I instanceof Fe){let y=tt(x);y.push(I.nonTerminalName);let g=tt(A);g.push(I.idx);let O={idx:_,def:I.definition.concat(o,Gt(m)),ruleStack:y,occurrenceStack:g};f.push(O)}else if(I instanceof Ue){let y={idx:_,def:Gt(m),ruleStack:x,occurrenceStack:A};f.push(y),f.push(s);let g={idx:_,def:I.definition.concat(Gt(m)),ruleStack:x,occurrenceStack:A};f.push(g)}else if(I instanceof nt){let y=new Oe({definition:I.definition,idx:I.idx}),g=I.definition.concat([y],Gt(m)),O={idx:_,def:g,ruleStack:x,occurrenceStack:A};f.push(O)}else if(I instanceof it){let y=new Re({terminalType:I.separator}),g=new Oe({definition:[y].concat(I.definition),idx:I.idx}),O=I.definition.concat([g],Gt(m)),M={idx:_,def:O,ruleStack:x,occurrenceStack:A};f.push(M)}else if(I instanceof Ke){let y={idx:_,def:Gt(m),ruleStack:x,occurrenceStack:A};f.push(y),f.push(s);let g=new Re({terminalType:I.separator}),O=new Oe({definition:[g].concat(I.definition),idx:I.idx}),M=I.definition.concat([O],Gt(m)),J={idx:_,def:M,ruleStack:x,occurrenceStack:A};f.push(J)}else if(I instanceof Oe){let y={idx:_,def:Gt(m),ruleStack:x,occurrenceStack:A};f.push(y),f.push(s);let g=new Oe({definition:I.definition,idx:I.idx}),O=I.definition.concat([g],Gt(m)),M={idx:_,def:O,ruleStack:x,occurrenceStack:A};f.push(M)}else if(I instanceof ze)for(let y=I.definition.length-1;y>=0;y--){let g=I.definition[y],O={idx:_,def:g.definition.concat(Gt(m)),ruleStack:x,occurrenceStack:A};f.push(O),f.push(s)}else if(I instanceof rt)f.push({idx:_,def:I.definition.concat(Gt(m)),ruleStack:x,occurrenceStack:A});else if(I instanceof br)f.push(tB(I,_,x,A));else throw Error("non exhaustive match")}return c}function tB(t,e,r,n){let i=tt(r);i.push(t.name);let o=tt(n);return o.push(1),{idx:e,def:t.definition,ruleStack:i,occurrenceStack:o}}var mt;(function(t){t[t.OPTION=0]="OPTION",t[t.REPETITION=1]="REPETITION",t[t.REPETITION_MANDATORY=2]="REPETITION_MANDATORY",t[t.REPETITION_MANDATORY_WITH_SEPARATOR=3]="REPETITION_MANDATORY_WITH_SEPARATOR",t[t.REPETITION_WITH_SEPARATOR=4]="REPETITION_WITH_SEPARATOR",t[t.ALTERNATION=5]="ALTERNATION"})(mt||(mt={}));function Kl(t){if(t instanceof Ue||t==="Option")return mt.OPTION;if(t instanceof Oe||t==="Repetition")return mt.REPETITION;if(t instanceof nt||t==="RepetitionMandatory")return mt.REPETITION_MANDATORY;if(t instanceof it||t==="RepetitionMandatoryWithSeparator")return mt.REPETITION_MANDATORY_WITH_SEPARATOR;if(t instanceof Ke||t==="RepetitionWithSeparator")return mt.REPETITION_WITH_SEPARATOR;if(t instanceof ze||t==="Alternation")return mt.ALTERNATION;throw Error("non exhaustive match")}function vd(t){let{occurrence:e,rule:r,prodType:n,maxLookahead:i}=t,o=Kl(n);return o===mt.ALTERNATION?Da(e,r,i):Ca(e,r,o,i)}function qA(t,e,r,n,i,o){let s=Da(t,e,r),a=JA(s)?Aa:mi;return o(s,n,a,i)}function HA(t,e,r,n,i,o){let s=Ca(t,e,i,r),a=JA(s)?Aa:mi;return o(s[0],a,n)}function KA(t,e,r,n){let i=t.length,o=Rr(t,s=>Rr(s,a=>a.length===1));if(e)return function(s){let a=K(s,l=>l.GATE);for(let l=0;l<i;l++){let u=t[l],c=u.length,f=a[l];if(!(f!==void 0&&f.call(this)===!1))e:for(let d=0;d<c;d++){let m=u[d],_=m.length;for(let x=0;x<_;x++){let A=this.LA(x+1);if(r(A,m[x])===!1)continue e}return l}}};if(o&&!n){let s=K(t,l=>Wt(l)),a=It(s,(l,u,c)=>(Z(u,f=>{te(l,f.tokenTypeIdx)||(l[f.tokenTypeIdx]=c),Z(f.categoryMatches,d=>{te(l,d)||(l[d]=c)})}),l),{});return function(){let l=this.LA(1);return a[l.tokenTypeIdx]}}else return function(){for(let s=0;s<i;s++){let a=t[s],l=a.length;e:for(let u=0;u<l;u++){let c=a[u],f=c.length;for(let d=0;d<f;d++){let m=this.LA(d+1);if(r(m,c[d])===!1)continue e}return s}}}}function zA(t,e,r){let n=Rr(t,o=>o.length===1),i=t.length;if(n&&!r){let o=Wt(t);if(o.length===1&&ve(o[0].categoryMatches)){let a=o[0].tokenTypeIdx;return function(){return this.LA(1).tokenTypeIdx===a}}else{let s=It(o,(a,l,u)=>(a[l.tokenTypeIdx]=!0,Z(l.categoryMatches,c=>{a[c]=!0}),a),[]);return function(){let a=this.LA(1);return s[a.tokenTypeIdx]===!0}}}else return function(){e:for(let o=0;o<i;o++){let s=t[o],a=s.length;for(let l=0;l<a;l++){let u=this.LA(l+1);if(e(u,s[l])===!1)continue e}return!0}return!1}}var HT=class extends pi{constructor(e,r,n){super(),this.topProd=e,this.targetOccurrence=r,this.targetProdType=n}startWalking(){return this.walk(this.topProd),this.restDef}checkIsTarget(e,r,n,i){return e.idx===this.targetOccurrence&&this.targetProdType===r?(this.restDef=n.concat(i),!0):!1}walkOption(e,r,n){this.checkIsTarget(e,mt.OPTION,r,n)||super.walkOption(e,r,n)}walkAtLeastOne(e,r,n){this.checkIsTarget(e,mt.REPETITION_MANDATORY,r,n)||super.walkOption(e,r,n)}walkAtLeastOneSep(e,r,n){this.checkIsTarget(e,mt.REPETITION_MANDATORY_WITH_SEPARATOR,r,n)||super.walkOption(e,r,n)}walkMany(e,r,n){this.checkIsTarget(e,mt.REPETITION,r,n)||super.walkOption(e,r,n)}walkManySep(e,r,n){this.checkIsTarget(e,mt.REPETITION_WITH_SEPARATOR,r,n)||super.walkOption(e,r,n)}},_d=class extends Lr{constructor(e,r,n){super(),this.targetOccurrence=e,this.targetProdType=r,this.targetRef=n,this.result=[]}checkIsTarget(e,r){e.idx===this.targetOccurrence&&this.targetProdType===r&&(this.targetRef===void 0||e===this.targetRef)&&(this.result=e.definition)}visitOption(e){this.checkIsTarget(e,mt.OPTION)}visitRepetition(e){this.checkIsTarget(e,mt.REPETITION)}visitRepetitionMandatory(e){this.checkIsTarget(e,mt.REPETITION_MANDATORY)}visitRepetitionMandatoryWithSeparator(e){this.checkIsTarget(e,mt.REPETITION_MANDATORY_WITH_SEPARATOR)}visitRepetitionWithSeparator(e){this.checkIsTarget(e,mt.REPETITION_WITH_SEPARATOR)}visitAlternation(e){this.checkIsTarget(e,mt.ALTERNATION)}};function jA(t){let e=new Array(t);for(let r=0;r<t;r++)e[r]=[];return e}function qT(t){let e=[""];for(let r=0;r<t.length;r++){let n=t[r],i=[];for(let o=0;o<e.length;o++){let s=e[o];i.push(s+"_"+n.tokenTypeIdx);for(let a=0;a<n.categoryMatches.length;a++){let l="_"+n.categoryMatches[a];i.push(s+l)}}e=i}return e}function rB(t,e,r){for(let n=0;n<t.length;n++){if(n===r)continue;let i=t[n];for(let o=0;o<e.length;o++){let s=e[o];if(i[s]===!0)return!1}}return!0}function YA(t,e){let r=K(t,s=>Td([s],1)),n=jA(r.length),i=K(r,s=>{let a={};return Z(s,l=>{let u=qT(l.partialPath);Z(u,c=>{a[c]=!0})}),a}),o=r;for(let s=1;s<=e;s++){let a=o;o=jA(a.length);for(let l=0;l<a.length;l++){let u=a[l];for(let c=0;c<u.length;c++){let f=u[c].partialPath,d=u[c].suffixDef,m=qT(f);if(rB(i,m,l)||ve(d)||f.length===e){let x=n[l];if(Rd(x,f)===!1){x.push(f);for(let A=0;A<m.length;A++){let I=m[A];i[l][I]=!0}}}else{let x=Td(d,s+1,f);o[l]=o[l].concat(x),Z(x,A=>{let I=qT(A.partialPath);Z(I,y=>{i[l][y]=!0})})}}}}return n}function Da(t,e,r,n){let i=new _d(t,mt.ALTERNATION,n);return e.accept(i),YA(i.result,r)}function Ca(t,e,r,n){let i=new _d(t,r);e.accept(i);let o=i.result,a=new HT(e,t,r).startWalking(),l=new rt({definition:o}),u=new rt({definition:a});return YA([l,u],n)}function Rd(t,e){e:for(let r=0;r<t.length;r++){let n=t[r];if(n.length===e.length){for(let i=0;i<n.length;i++){let o=e[i],s=n[i];if((o===s||s.categoryMatchesMap[o.tokenTypeIdx]!==void 0)===!1)continue e}return!0}}return!1}function XA(t,e){return t.length<e.length&&Rr(t,(r,n)=>{let i=e[n];return r===i||i.categoryMatchesMap[r.tokenTypeIdx]})}function JA(t){return Rr(t,e=>Rr(e,r=>Rr(r,n=>ve(n.categoryMatches))))}function QA(t){let e=t.lookaheadStrategy.validate({rules:t.rules,tokenTypes:t.tokenTypes,grammarName:t.grammarName});return K(e,r=>Object.assign({type:er.CUSTOM_LOOKAHEAD_VALIDATION},r))}function ZA(t,e,r,n){let i=dr(t,l=>nB(l,r)),o=uB(t,e,r),s=dr(t,l=>sB(l,r)),a=dr(t,l=>oB(l,t,n,r));return i.concat(o,s,a)}function nB(t,e){let r=new KT;t.accept(r);let n=r.allProductions,i=bT(n,iB),o=Yr(i,a=>a.length>1);return K(We(o),a=>{let l=or(a),u=e.buildDuplicateFoundError(t,a),c=Xr(l),f={message:u,type:er.DUPLICATE_PRODUCTIONS,ruleName:t.name,dslName:c,occurrence:l.idx},d=eS(l);return d&&(f.parameter=d),f})}function iB(t){return`${Xr(t)}_#_${t.idx}_#_${eS(t)}`}function eS(t){return t instanceof Re?t.terminalType.name:t instanceof Fe?t.nonTerminalName:""}var KT=class extends Lr{constructor(){super(...arguments),this.allProductions=[]}visitNonTerminal(e){this.allProductions.push(e)}visitOption(e){this.allProductions.push(e)}visitRepetitionWithSeparator(e){this.allProductions.push(e)}visitRepetitionMandatory(e){this.allProductions.push(e)}visitRepetitionMandatoryWithSeparator(e){this.allProductions.push(e)}visitRepetition(e){this.allProductions.push(e)}visitAlternation(e){this.allProductions.push(e)}visitTerminal(e){this.allProductions.push(e)}};function oB(t,e,r,n){let i=[];if(It(e,(s,a)=>a.name===t.name?s+1:s,0)>1){let s=n.buildDuplicateRuleNameError({topLevelRule:t,grammarName:r});i.push({message:s,type:er.DUPLICATE_RULE_NAME,ruleName:t.name})}return i}function tS(t,e,r){let n=[],i;return dt(e,t)||(i=`Invalid rule override, rule: ->${t}<- cannot be overridden in the grammar: ->${r}<-as it is not defined in any of the super grammars `,n.push({message:i,type:er.INVALID_RULE_OVERRIDE,ruleName:t})),n}function YT(t,e,r,n=[]){let i=[],o=xd(e.definition);if(ve(o))return[];{let s=t.name;dt(o,t)&&i.push({message:r.buildLeftRecursionError({topLevelRule:t,leftRecursionPath:n}),type:er.LEFT_RECURSION,ruleName:s});let l=io(o,n.concat([t])),u=dr(l,c=>{let f=tt(n);return f.push(c),YT(t,c,r,f)});return i.concat(u)}}function xd(t){let e=[];if(ve(t))return e;let r=or(t);if(r instanceof Fe)e.push(r.referencedRule);else if(r instanceof rt||r instanceof Ue||r instanceof nt||r instanceof it||r instanceof Ke||r instanceof Oe)e=e.concat(xd(r.definition));else if(r instanceof ze)e=Wt(K(r.definition,o=>xd(o.definition)));else if(!(r instanceof Re))throw Error("non exhaustive match");let n=Vo(r),i=t.length>1;if(n&&i){let o=Gt(t);return e.concat(xd(o))}else return e}var zl=class extends Lr{constructor(){super(...arguments),this.alternations=[]}visitAlternation(e){this.alternations.push(e)}};function rS(t,e){let r=new zl;t.accept(r);let n=r.alternations;return dr(n,o=>{let s=di(o.definition);return dr(s,(a,l)=>{let u=yd([a],[],mi,1);return ve(u)?[{message:e.buildEmptyAlternationError({topLevelRule:t,alternation:o,emptyChoiceIdx:l}),type:er.NONE_LAST_EMPTY_ALT,ruleName:t.name,occurrence:o.idx,alternative:l+1}]:[]})})}function nS(t,e,r){let n=new zl;t.accept(n);let i=n.alternations;return i=oo(i,s=>s.ignoreAmbiguities===!0),dr(i,s=>{let a=s.idx,l=s.maxLookahead||e,u=Da(a,t,l,s),c=aB(u,s,t,r),f=lB(u,s,t,r);return c.concat(f)})}var zT=class extends Lr{constructor(){super(...arguments),this.allProductions=[]}visitRepetitionWithSeparator(e){this.allProductions.push(e)}visitRepetitionMandatory(e){this.allProductions.push(e)}visitRepetitionMandatoryWithSeparator(e){this.allProductions.push(e)}visitRepetition(e){this.allProductions.push(e)}};function sB(t,e){let r=new zl;t.accept(r);let n=r.alternations;return dr(n,o=>o.definition.length>255?[{message:e.buildTooManyAlternativesError({topLevelRule:t,alternation:o}),type:er.TOO_MANY_ALTS,ruleName:t.name,occurrence:o.idx}]:[])}function iS(t,e,r){let n=[];return Z(t,i=>{let o=new zT;i.accept(o);let s=o.allProductions;Z(s,a=>{let l=Kl(a),u=a.maxLookahead||e,c=a.idx,d=Ca(c,i,l,u)[0];if(ve(Wt(d))){let m=r.buildEmptyRepetitionError({topLevelRule:i,repetition:a});n.push({message:m,type:er.NO_NON_EMPTY_LOOKAHEAD,ruleName:i.name})}})}),n}function aB(t,e,r,n){let i=[],o=It(t,(a,l,u)=>(e.definition[u].ignoreAmbiguities===!0||Z(l,c=>{let f=[u];Z(t,(d,m)=>{u!==m&&Rd(d,c)&&e.definition[m].ignoreAmbiguities!==!0&&f.push(m)}),f.length>1&&!Rd(i,c)&&(i.push(c),a.push({alts:f,path:c}))}),a),[]);return K(o,a=>{let l=K(a.alts,c=>c+1);return{message:n.buildAlternationAmbiguityError({topLevelRule:r,alternation:e,ambiguityIndices:l,prefixPath:a.path}),type:er.AMBIGUOUS_ALTS,ruleName:r.name,occurrence:e.idx,alternatives:a.alts}})}function lB(t,e,r,n){let i=It(t,(s,a,l)=>{let u=K(a,c=>({idx:l,path:c}));return s.concat(u)},[]);return Kn(dr(i,s=>{if(e.definition[s.idx].ignoreAmbiguities===!0)return[];let l=s.idx,u=s.path,c=ir(i,d=>e.definition[d.idx].ignoreAmbiguities!==!0&&d.idx<l&&XA(d.path,u));return K(c,d=>{let m=[d.idx+1,l+1],_=e.idx===0?"":e.idx;return{message:n.buildAlternationPrefixAmbiguityError({topLevelRule:r,alternation:e,ambiguityIndices:m,prefixPath:d.path}),type:er.AMBIGUOUS_PREFIX_ALTS,ruleName:r.name,occurrence:_,alternatives:m}})}))}function uB(t,e,r){let n=[],i=K(e,o=>o.name);return Z(t,o=>{let s=o.name;if(dt(i,s)){let a=r.buildNamespaceConflictError(o);n.push({message:a,type:er.CONFLICT_TOKENS_RULES_NAMESPACE,ruleName:s})}}),n}function oS(t){let e=va(t,{errMsgProvider:WA}),r={};return Z(t.rules,n=>{r[n.name]=n}),GA(r,e.errMsgProvider)}function sS(t){return t=va(t,{errMsgProvider:Sn}),ZA(t.rules,t.tokenTypes,t.errMsgProvider,t.grammarName)}var aS="MismatchedTokenException",lS="NoViableAltException",uS="EarlyExitException",cS="NotAllInputParsedException",fS=[aS,lS,uS,cS];Object.freeze(fS);function so(t){return dt(fS,t.name)}var ba=class extends Error{constructor(e,r){super(e),this.token=r,this.resyncedTokens=[],Object.setPrototypeOf(this,new.target.prototype),Error.captureStackTrace&&Error.captureStackTrace(this,this.constructor)}},jo=class extends ba{constructor(e,r,n){super(e,r),this.previousToken=n,this.name=aS}},Yl=class extends ba{constructor(e,r,n){super(e,r),this.previousToken=n,this.name=lS}},Xl=class extends ba{constructor(e,r){super(e,r),this.name=cS}},Jl=class extends ba{constructor(e,r,n){super(e,r),this.previousToken=n,this.name=uS}};var XT={},QT="InRuleRecoveryException",JT=class extends Error{constructor(e){super(e),this.name=QT}},Nd=class{initRecoverable(e){this.firstAfterRepMap={},this.resyncFollows={},this.recoveryEnabled=te(e,"recoveryEnabled")?e.recoveryEnabled:kr.recoveryEnabled,this.recoveryEnabled&&(this.attemptInRepetitionRecovery=cB)}getTokenToInsert(e){let r=Go(e,"",NaN,NaN,NaN,NaN,NaN,NaN);return r.isInsertedInRecovery=!0,r}canTokenTypeBeInsertedInRecovery(e){return!0}canTokenTypeBeDeletedInRecovery(e){return!0}tryInRepetitionRecovery(e,r,n,i){let o=this.findReSyncTokenType(),s=this.exportLexerState(),a=[],l=!1,u=this.LA(1),c=this.LA(1),f=()=>{let d=this.LA(0),m=this.errorMessageProvider.buildMismatchTokenMessage({expected:i,actual:u,previous:d,ruleName:this.getCurrRuleFullName()}),_=new jo(m,u,this.LA(0));_.resyncedTokens=di(a),this.SAVE_ERROR(_)};for(;!l;)if(this.tokenMatcher(c,i)){f();return}else if(n.call(this)){f(),e.apply(this,r);return}else this.tokenMatcher(c,o)?l=!0:(c=this.SKIP_TOKEN(),this.addToResyncTokens(c,a));this.importLexerState(s)}shouldInRepetitionRecoveryBeTried(e,r,n){return!(n===!1||this.tokenMatcher(this.LA(1),e)||this.isBackTracking()||this.canPerformInRuleRecovery(e,this.getFollowsForInRuleRecovery(e,r)))}getFollowsForInRuleRecovery(e,r){let n=this.getCurrentGrammarPath(e,r);return this.getNextPossibleTokenTypes(n)}tryInRuleRecovery(e,r){if(this.canRecoverWithSingleTokenInsertion(e,r))return this.getTokenToInsert(e);if(this.canRecoverWithSingleTokenDeletion(e)){let n=this.SKIP_TOKEN();return this.consumeToken(),n}throw new JT("sad sad panda")}canPerformInRuleRecovery(e,r){return this.canRecoverWithSingleTokenInsertion(e,r)||this.canRecoverWithSingleTokenDeletion(e)}canRecoverWithSingleTokenInsertion(e,r){if(!this.canTokenTypeBeInsertedInRecovery(e)||ve(r))return!1;let n=this.LA(1);return Yn(r,o=>this.tokenMatcher(n,o))!==void 0}canRecoverWithSingleTokenDeletion(e){return this.canTokenTypeBeDeletedInRecovery(e)?this.tokenMatcher(this.LA(2),e):!1}isInCurrentRuleReSyncSet(e){let r=this.getCurrFollowKey(),n=this.getFollowSetFromFollowKey(r);return dt(n,e)}findReSyncTokenType(){let e=this.flattenFollowSet(),r=this.LA(1),n=2;for(;;){let i=Yn(e,o=>jl(r,o));if(i!==void 0)return i;r=this.LA(n),n++}}getCurrFollowKey(){if(this.RULE_STACK.length===1)return XT;let e=this.getLastExplicitRuleShortName(),r=this.getLastExplicitRuleOccurrenceIndex(),n=this.getPreviousExplicitRuleShortName();return{ruleName:this.shortRuleNameToFullName(e),idxInCallingRule:r,inRule:this.shortRuleNameToFullName(n)}}buildFullFollowKeyStack(){let e=this.RULE_STACK,r=this.RULE_OCCURRENCE_STACK;return K(e,(n,i)=>i===0?XT:{ruleName:this.shortRuleNameToFullName(n),idxInCallingRule:r[i],inRule:this.shortRuleNameToFullName(e[i-1])})}flattenFollowSet(){let e=K(this.buildFullFollowKeyStack(),r=>this.getFollowSetFromFollowKey(r));return Wt(e)}getFollowSetFromFollowKey(e){if(e===XT)return[nn];let r=e.ruleName+e.idxInCallingRule+ad+e.inRule;return this.resyncFollows[r]}addToResyncTokens(e,r){return this.tokenMatcher(e,nn)||r.push(e),r}reSyncTo(e){let r=[],n=this.LA(1);for(;this.tokenMatcher(n,e)===!1;)n=this.SKIP_TOKEN(),this.addToResyncTokens(n,r);return di(r)}attemptInRepetitionRecovery(e,r,n,i,o,s,a){}getCurrentGrammarPath(e,r){let n=this.getHumanReadableRuleStack(),i=tt(this.RULE_OCCURRENCE_STACK);return{ruleStack:n,occurrenceStack:i,lastTok:e,lastTokOccurrence:r}}getHumanReadableRuleStack(){return K(this.RULE_STACK,e=>this.shortRuleNameToFullName(e))}};function cB(t,e,r,n,i,o,s){let a=this.getKeyForAutomaticLookahead(n,i),l=this.firstAfterRepMap[a];if(l===void 0){let d=this.getCurrRuleFullName(),m=this.getGAstProductions()[d];l=new o(m,i).startWalking(),this.firstAfterRepMap[a]=l}let u=l.token,c=l.occurrence,f=l.isEndOfRule;this.RULE_STACK.length===1&&f&&u===void 0&&(u=nn,c=1),!(u===void 0||c===void 0)&&this.shouldInRepetitionRecoveryBeTried(u,c,s)&&this.tryInRepetitionRecovery(t,e,r,u)}function Ed(t,e,r){return r|e|t}var yi=class{constructor(e){var r;this.maxLookahead=(r=e==null?void 0:e.maxLookahead)!==null&&r!==void 0?r:kr.maxLookahead}validate(e){let r=this.validateNoLeftRecursion(e.rules);if(ve(r)){let n=this.validateEmptyOrAlternatives(e.rules),i=this.validateAmbiguousAlternationAlternatives(e.rules,this.maxLookahead),o=this.validateSomeNonEmptyLookaheadPath(e.rules,this.maxLookahead);return[...r,...n,...i,...o]}return r}validateNoLeftRecursion(e){return dr(e,r=>YT(r,r,Sn))}validateEmptyOrAlternatives(e){return dr(e,r=>rS(r,Sn))}validateAmbiguousAlternationAlternatives(e,r){return dr(e,n=>nS(n,r,Sn))}validateSomeNonEmptyLookaheadPath(e,r){return iS(e,r,Sn)}buildLookaheadForAlternation(e){return qA(e.prodOccurrence,e.rule,e.maxLookahead,e.hasPredicates,e.dynamicTokensEnabled,KA)}buildLookaheadForOptional(e){return HA(e.prodOccurrence,e.rule,e.maxLookahead,e.dynamicTokensEnabled,Kl(e.prodType),zA)}};var Od=class{initLooksAhead(e){this.dynamicTokensEnabled=te(e,"dynamicTokensEnabled")?e.dynamicTokensEnabled:kr.dynamicTokensEnabled,this.maxLookahead=te(e,"maxLookahead")?e.maxLookahead:kr.maxLookahead,this.lookaheadStrategy=te(e,"lookaheadStrategy")?e.lookaheadStrategy:new yi({maxLookahead:this.maxLookahead}),this.lookAheadFuncsCache=new Map}preComputeLookaheadFunctions(e){Z(e,r=>{this.TRACE_INIT(`${r.name} Rule Lookahead`,()=>{let{alternation:n,repetition:i,option:o,repetitionMandatory:s,repetitionMandatoryWithSeparator:a,repetitionWithSeparator:l}=fB(r);Z(n,u=>{let c=u.idx===0?"":u.idx;this.TRACE_INIT(`${Xr(u)}${c}`,()=>{let f=this.lookaheadStrategy.buildLookaheadForAlternation({prodOccurrence:u.idx,rule:r,maxLookahead:u.maxLookahead||this.maxLookahead,hasPredicates:u.hasPredicates,dynamicTokensEnabled:this.dynamicTokensEnabled}),d=Ed(this.fullRuleNameToShort[r.name],256,u.idx);this.setLaFuncCache(d,f)})}),Z(i,u=>{this.computeLookaheadFunc(r,u.idx,768,"Repetition",u.maxLookahead,Xr(u))}),Z(o,u=>{this.computeLookaheadFunc(r,u.idx,512,"Option",u.maxLookahead,Xr(u))}),Z(s,u=>{this.computeLookaheadFunc(r,u.idx,1024,"RepetitionMandatory",u.maxLookahead,Xr(u))}),Z(a,u=>{this.computeLookaheadFunc(r,u.idx,1536,"RepetitionMandatoryWithSeparator",u.maxLookahead,Xr(u))}),Z(l,u=>{this.computeLookaheadFunc(r,u.idx,1280,"RepetitionWithSeparator",u.maxLookahead,Xr(u))})})})}computeLookaheadFunc(e,r,n,i,o,s){this.TRACE_INIT(`${s}${r===0?"":r}`,()=>{let a=this.lookaheadStrategy.buildLookaheadForOptional({prodOccurrence:r,rule:e,maxLookahead:o||this.maxLookahead,dynamicTokensEnabled:this.dynamicTokensEnabled,prodType:i}),l=Ed(this.fullRuleNameToShort[e.name],n,r);this.setLaFuncCache(l,a)})}getKeyForAutomaticLookahead(e,r){let n=this.getLastExplicitRuleShortName();return Ed(n,e,r)}getLaFuncFromCache(e){return this.lookAheadFuncsCache.get(e)}setLaFuncCache(e,r){this.lookAheadFuncsCache.set(e,r)}},ZT=class extends Lr{constructor(){super(...arguments),this.dslMethods={option:[],alternation:[],repetition:[],repetitionWithSeparator:[],repetitionMandatory:[],repetitionMandatoryWithSeparator:[]}}reset(){this.dslMethods={option:[],alternation:[],repetition:[],repetitionWithSeparator:[],repetitionMandatory:[],repetitionMandatoryWithSeparator:[]}}visitOption(e){this.dslMethods.option.push(e)}visitRepetitionWithSeparator(e){this.dslMethods.repetitionWithSeparator.push(e)}visitRepetitionMandatory(e){this.dslMethods.repetitionMandatory.push(e)}visitRepetitionMandatoryWithSeparator(e){this.dslMethods.repetitionMandatoryWithSeparator.push(e)}visitRepetition(e){this.dslMethods.repetition.push(e)}visitAlternation(e){this.dslMethods.alternation.push(e)}},Id=new ZT;function fB(t){Id.reset(),t.accept(Id);let e=Id.dslMethods;return Id.reset(),e}function ry(t,e){isNaN(t.startOffset)===!0?(t.startOffset=e.startOffset,t.endOffset=e.endOffset):t.endOffset<e.endOffset&&(t.endOffset=e.endOffset)}function ny(t,e){isNaN(t.startOffset)===!0?(t.startOffset=e.startOffset,t.startColumn=e.startColumn,t.startLine=e.startLine,t.endOffset=e.endOffset,t.endColumn=e.endColumn,t.endLine=e.endLine):t.endOffset<e.endOffset&&(t.endOffset=e.endOffset,t.endColumn=e.endColumn,t.endLine=e.endLine)}function dS(t,e,r){t.children[r]===void 0?t.children[r]=[e]:t.children[r].push(e)}function pS(t,e,r){t.children[e]===void 0?t.children[e]=[r]:t.children[e].push(r)}var dB="name";function iy(t,e){Object.defineProperty(t,dB,{enumerable:!1,configurable:!0,writable:!1,value:e})}function pB(t,e){let r=Ze(t),n=r.length;for(let i=0;i<n;i++){let o=r[i],s=t[o],a=s.length;for(let l=0;l<a;l++){let u=s[l];u.tokenTypeIdx===void 0&&this[u.name](u.children,e)}}}function mS(t,e){let r=function(){};iy(r,t+"BaseSemantics");let n={visit:function(i,o){if(se(i)&&(i=i[0]),!xr(i))return this[i.name](i.children,o)},validateVisitor:function(){let i=mB(this,e);if(!ve(i)){let o=K(i,s=>s.msg);throw Error(`Errors Detected in CST Visitor <${this.constructor.name}>:
	${o.join(`

`).replace(/\n/g,`
	`)}`)}}};return r.prototype=n,r.prototype.constructor=r,r._RULE_NAMES=e,r}function hS(t,e,r){let n=function(){};iy(n,t+"BaseSemanticsWithDefaults");let i=Object.create(r.prototype);return Z(e,o=>{i[o]=pB}),n.prototype=i,n.prototype.constructor=n,n}var oy;(function(t){t[t.REDUNDANT_METHOD=0]="REDUNDANT_METHOD",t[t.MISSING_METHOD=1]="MISSING_METHOD"})(oy||(oy={}));function mB(t,e){return hB(t,e)}function hB(t,e){let r=ir(e,i=>Cr(t[i])===!1),n=K(r,i=>({msg:`Missing visitor method: <${i}> on ${t.constructor.name} CST Visitor.`,type:oy.MISSING_METHOD,methodName:i}));return Kn(n)}var Cd=class{initTreeBuilder(e){if(this.CST_STACK=[],this.outputCst=e.outputCst,this.nodeLocationTracking=te(e,"nodeLocationTracking")?e.nodeLocationTracking:kr.nodeLocationTracking,!this.outputCst)this.cstInvocationStateUpdate=Et,this.cstFinallyStateUpdate=Et,this.cstPostTerminal=Et,this.cstPostNonTerminal=Et,this.cstPostRule=Et;else if(/full/i.test(this.nodeLocationTracking))this.recoveryEnabled?(this.setNodeLocationFromToken=ny,this.setNodeLocationFromNode=ny,this.cstPostRule=Et,this.setInitialNodeLocation=this.setInitialNodeLocationFullRecovery):(this.setNodeLocationFromToken=Et,this.setNodeLocationFromNode=Et,this.cstPostRule=this.cstPostRuleFull,this.setInitialNodeLocation=this.setInitialNodeLocationFullRegular);else if(/onlyOffset/i.test(this.nodeLocationTracking))this.recoveryEnabled?(this.setNodeLocationFromToken=ry,this.setNodeLocationFromNode=ry,this.cstPostRule=Et,this.setInitialNodeLocation=this.setInitialNodeLocationOnlyOffsetRecovery):(this.setNodeLocationFromToken=Et,this.setNodeLocationFromNode=Et,this.cstPostRule=this.cstPostRuleOnlyOffset,this.setInitialNodeLocation=this.setInitialNodeLocationOnlyOffsetRegular);else if(/none/i.test(this.nodeLocationTracking))this.setNodeLocationFromToken=Et,this.setNodeLocationFromNode=Et,this.cstPostRule=Et,this.setInitialNodeLocation=Et;else throw Error(`Invalid <nodeLocationTracking> config option: "${e.nodeLocationTracking}"`)}setInitialNodeLocationOnlyOffsetRecovery(e){e.location={startOffset:NaN,endOffset:NaN}}setInitialNodeLocationOnlyOffsetRegular(e){e.location={startOffset:this.LA(1).startOffset,endOffset:NaN}}setInitialNodeLocationFullRecovery(e){e.location={startOffset:NaN,startLine:NaN,startColumn:NaN,endOffset:NaN,endLine:NaN,endColumn:NaN}}setInitialNodeLocationFullRegular(e){let r=this.LA(1);e.location={startOffset:r.startOffset,startLine:r.startLine,startColumn:r.startColumn,endOffset:NaN,endLine:NaN,endColumn:NaN}}cstInvocationStateUpdate(e){let r={name:e,children:Object.create(null)};this.setInitialNodeLocation(r),this.CST_STACK.push(r)}cstFinallyStateUpdate(){this.CST_STACK.pop()}cstPostRuleFull(e){let r=this.LA(0),n=e.location;n.startOffset<=r.startOffset?(n.endOffset=r.endOffset,n.endLine=r.endLine,n.endColumn=r.endColumn):(n.startOffset=NaN,n.startLine=NaN,n.startColumn=NaN)}cstPostRuleOnlyOffset(e){let r=this.LA(0),n=e.location;n.startOffset<=r.startOffset?n.endOffset=r.endOffset:n.startOffset=NaN}cstPostTerminal(e,r){let n=this.CST_STACK[this.CST_STACK.length-1];dS(n,r,e),this.setNodeLocationFromToken(n.location,r)}cstPostNonTerminal(e,r){let n=this.CST_STACK[this.CST_STACK.length-1];pS(n,r,e),this.setNodeLocationFromNode(n.location,e.location)}getBaseCstVisitorConstructor(){if(xr(this.baseCstVisitorConstructor)){let e=mS(this.className,Ze(this.gastProductionsCache));return this.baseCstVisitorConstructor=e,e}return this.baseCstVisitorConstructor}getBaseCstVisitorConstructorWithDefaults(){if(xr(this.baseCstVisitorWithDefaultsConstructor)){let e=hS(this.className,Ze(this.gastProductionsCache),this.getBaseCstVisitorConstructor());return this.baseCstVisitorWithDefaultsConstructor=e,e}return this.baseCstVisitorWithDefaultsConstructor}getLastExplicitRuleShortName(){let e=this.RULE_STACK;return e[e.length-1]}getPreviousExplicitRuleShortName(){let e=this.RULE_STACK;return e[e.length-2]}getLastExplicitRuleOccurrenceIndex(){let e=this.RULE_OCCURRENCE_STACK;return e[e.length-1]}};var bd=class{initLexerAdapter(){this.tokVector=[],this.tokVectorLength=0,this.currIdx=-1}set input(e){if(this.selfAnalysisDone!==!0)throw Error("Missing <performSelfAnalysis> invocation at the end of the Parser's constructor.");this.reset(),this.tokVector=e,this.tokVectorLength=e.length}get input(){return this.tokVector}SKIP_TOKEN(){return this.currIdx<=this.tokVector.length-2?(this.consumeToken(),this.LA(1)):La}LA(e){let r=this.currIdx+e;return r<0||this.tokVectorLength<=r?La:this.tokVector[r]}consumeToken(){this.currIdx++}exportLexerState(){return this.currIdx}importLexerState(e){this.currIdx=e}resetLexerState(){this.currIdx=-1}moveToTerminatedState(){this.currIdx=this.tokVector.length-1}getLexerPosition(){return this.exportLexerState()}};var Ld=class{ACTION(e){return e.call(this)}consume(e,r,n){return this.consumeInternal(r,e,n)}subrule(e,r,n){return this.subruleInternal(r,e,n)}option(e,r){return this.optionInternal(r,e)}or(e,r){return this.orInternal(r,e)}many(e,r){return this.manyInternal(e,r)}atLeastOne(e,r){return this.atLeastOneInternal(e,r)}CONSUME(e,r){return this.consumeInternal(e,0,r)}CONSUME1(e,r){return this.consumeInternal(e,1,r)}CONSUME2(e,r){return this.consumeInternal(e,2,r)}CONSUME3(e,r){return this.consumeInternal(e,3,r)}CONSUME4(e,r){return this.consumeInternal(e,4,r)}CONSUME5(e,r){return this.consumeInternal(e,5,r)}CONSUME6(e,r){return this.consumeInternal(e,6,r)}CONSUME7(e,r){return this.consumeInternal(e,7,r)}CONSUME8(e,r){return this.consumeInternal(e,8,r)}CONSUME9(e,r){return this.consumeInternal(e,9,r)}SUBRULE(e,r){return this.subruleInternal(e,0,r)}SUBRULE1(e,r){return this.subruleInternal(e,1,r)}SUBRULE2(e,r){return this.subruleInternal(e,2,r)}SUBRULE3(e,r){return this.subruleInternal(e,3,r)}SUBRULE4(e,r){return this.subruleInternal(e,4,r)}SUBRULE5(e,r){return this.subruleInternal(e,5,r)}SUBRULE6(e,r){return this.subruleInternal(e,6,r)}SUBRULE7(e,r){return this.subruleInternal(e,7,r)}SUBRULE8(e,r){return this.subruleInternal(e,8,r)}SUBRULE9(e,r){return this.subruleInternal(e,9,r)}OPTION(e){return this.optionInternal(e,0)}OPTION1(e){return this.optionInternal(e,1)}OPTION2(e){return this.optionInternal(e,2)}OPTION3(e){return this.optionInternal(e,3)}OPTION4(e){return this.optionInternal(e,4)}OPTION5(e){return this.optionInternal(e,5)}OPTION6(e){return this.optionInternal(e,6)}OPTION7(e){return this.optionInternal(e,7)}OPTION8(e){return this.optionInternal(e,8)}OPTION9(e){return this.optionInternal(e,9)}OR(e){return this.orInternal(e,0)}OR1(e){return this.orInternal(e,1)}OR2(e){return this.orInternal(e,2)}OR3(e){return this.orInternal(e,3)}OR4(e){return this.orInternal(e,4)}OR5(e){return this.orInternal(e,5)}OR6(e){return this.orInternal(e,6)}OR7(e){return this.orInternal(e,7)}OR8(e){return this.orInternal(e,8)}OR9(e){return this.orInternal(e,9)}MANY(e){this.manyInternal(0,e)}MANY1(e){this.manyInternal(1,e)}MANY2(e){this.manyInternal(2,e)}MANY3(e){this.manyInternal(3,e)}MANY4(e){this.manyInternal(4,e)}MANY5(e){this.manyInternal(5,e)}MANY6(e){this.manyInternal(6,e)}MANY7(e){this.manyInternal(7,e)}MANY8(e){this.manyInternal(8,e)}MANY9(e){this.manyInternal(9,e)}MANY_SEP(e){this.manySepFirstInternal(0,e)}MANY_SEP1(e){this.manySepFirstInternal(1,e)}MANY_SEP2(e){this.manySepFirstInternal(2,e)}MANY_SEP3(e){this.manySepFirstInternal(3,e)}MANY_SEP4(e){this.manySepFirstInternal(4,e)}MANY_SEP5(e){this.manySepFirstInternal(5,e)}MANY_SEP6(e){this.manySepFirstInternal(6,e)}MANY_SEP7(e){this.manySepFirstInternal(7,e)}MANY_SEP8(e){this.manySepFirstInternal(8,e)}MANY_SEP9(e){this.manySepFirstInternal(9,e)}AT_LEAST_ONE(e){this.atLeastOneInternal(0,e)}AT_LEAST_ONE1(e){return this.atLeastOneInternal(1,e)}AT_LEAST_ONE2(e){this.atLeastOneInternal(2,e)}AT_LEAST_ONE3(e){this.atLeastOneInternal(3,e)}AT_LEAST_ONE4(e){this.atLeastOneInternal(4,e)}AT_LEAST_ONE5(e){this.atLeastOneInternal(5,e)}AT_LEAST_ONE6(e){this.atLeastOneInternal(6,e)}AT_LEAST_ONE7(e){this.atLeastOneInternal(7,e)}AT_LEAST_ONE8(e){this.atLeastOneInternal(8,e)}AT_LEAST_ONE9(e){this.atLeastOneInternal(9,e)}AT_LEAST_ONE_SEP(e){this.atLeastOneSepFirstInternal(0,e)}AT_LEAST_ONE_SEP1(e){this.atLeastOneSepFirstInternal(1,e)}AT_LEAST_ONE_SEP2(e){this.atLeastOneSepFirstInternal(2,e)}AT_LEAST_ONE_SEP3(e){this.atLeastOneSepFirstInternal(3,e)}AT_LEAST_ONE_SEP4(e){this.atLeastOneSepFirstInternal(4,e)}AT_LEAST_ONE_SEP5(e){this.atLeastOneSepFirstInternal(5,e)}AT_LEAST_ONE_SEP6(e){this.atLeastOneSepFirstInternal(6,e)}AT_LEAST_ONE_SEP7(e){this.atLeastOneSepFirstInternal(7,e)}AT_LEAST_ONE_SEP8(e){this.atLeastOneSepFirstInternal(8,e)}AT_LEAST_ONE_SEP9(e){this.atLeastOneSepFirstInternal(9,e)}RULE(e,r,n=ka){if(dt(this.definedRulesNames,e)){let s={message:Sn.buildDuplicateRuleNameError({topLevelRule:e,grammarName:this.className}),type:er.DUPLICATE_RULE_NAME,ruleName:e};this.definitionErrors.push(s)}this.definedRulesNames.push(e);let i=this.defineRule(e,r,n);return this[e]=i,i}OVERRIDE_RULE(e,r,n=ka){let i=tS(e,this.definedRulesNames,this.className);this.definitionErrors=this.definitionErrors.concat(i);let o=this.defineRule(e,r,n);return this[e]=o,o}BACKTRACK(e,r){return function(){this.isBackTrackingStack.push(1);let n=this.saveRecogState();try{return e.apply(this,r),!0}catch(i){if(so(i))return!1;throw i}finally{this.reloadRecogState(n),this.isBackTrackingStack.pop()}}}getGAstProductions(){return this.gastProductionsCache}getSerializedGastProductions(){return sd(We(this.gastProductionsCache))}};var kd=class{initRecognizerEngine(e,r){if(this.className=this.constructor.name,this.shortRuleNameToFull={},this.fullRuleNameToShort={},this.ruleShortNameIdx=256,this.tokenMatcher=Aa,this.subruleIdx=0,this.definedRulesNames=[],this.tokensMap={},this.isBackTrackingStack=[],this.RULE_STACK=[],this.RULE_OCCURRENCE_STACK=[],this.gastProductionsCache={},te(r,"serializedGrammar"))throw Error(`The Parser's configuration can no longer contain a <serializedGrammar> property.
	See: https://chevrotain.io/docs/changes/BREAKING_CHANGES.html#_6-0-0
	For Further details.`);if(se(e)){if(ve(e))throw Error(`A Token Vocabulary cannot be empty.
	Note that the first argument for the parser constructor
	is no longer a Token vector (since v4.0).`);if(typeof e[0].startOffset=="number")throw Error(`The Parser constructor no longer accepts a token vector as the first argument.
	See: https://chevrotain.io/docs/changes/BREAKING_CHANGES.html#_4-0-0
	For Further details.`)}if(se(e))this.tokensMap=It(e,(o,s)=>(o[s.name]=s,o),{});else if(te(e,"modes")&&Rr(Wt(We(e.modes)),kA)){let o=Wt(We(e.modes)),s=Ra(o);this.tokensMap=It(s,(a,l)=>(a[l.name]=l,a),{})}else if(Nt(e))this.tokensMap=tt(e);else throw new Error("<tokensDictionary> argument must be An Array of Token constructors, A dictionary of Token constructors or an IMultiModeLexerDefinition");this.tokensMap.EOF=nn;let n=te(e,"modes")?Wt(We(e.modes)):We(e),i=Rr(n,o=>ve(o.categoryMatches));this.tokenMatcher=i?Aa:mi,hi(We(this.tokensMap))}defineRule(e,r,n){if(this.selfAnalysisDone)throw Error(`Grammar rule <${e}> may not be defined after the 'performSelfAnalysis' method has been called'
Make sure that all grammar rule definitions are done before 'performSelfAnalysis' is called.`);let i=te(n,"resyncEnabled")?n.resyncEnabled:ka.resyncEnabled,o=te(n,"recoveryValueFunc")?n.recoveryValueFunc:ka.recoveryValueFunc,s=this.ruleShortNameIdx<<12;this.ruleShortNameIdx++,this.shortRuleNameToFull[s]=e,this.fullRuleNameToShort[e]=s;let a;return this.outputCst===!0?a=function(...c){try{this.ruleInvocationStateUpdate(s,e,this.subruleIdx),r.apply(this,c);let f=this.CST_STACK[this.CST_STACK.length-1];return this.cstPostRule(f),f}catch(f){return this.invokeRuleCatch(f,i,o)}finally{this.ruleFinallyStateUpdate()}}:a=function(...c){try{return this.ruleInvocationStateUpdate(s,e,this.subruleIdx),r.apply(this,c)}catch(f){return this.invokeRuleCatch(f,i,o)}finally{this.ruleFinallyStateUpdate()}},Object.assign(a,{ruleName:e,originalGrammarAction:r})}invokeRuleCatch(e,r,n){let i=this.RULE_STACK.length===1,o=r&&!this.isBackTracking()&&this.recoveryEnabled;if(so(e)){let s=e;if(o){let a=this.findReSyncTokenType();if(this.isInCurrentRuleReSyncSet(a))if(s.resyncedTokens=this.reSyncTo(a),this.outputCst){let l=this.CST_STACK[this.CST_STACK.length-1];return l.recoveredNode=!0,l}else return n(e);else{if(this.outputCst){let l=this.CST_STACK[this.CST_STACK.length-1];l.recoveredNode=!0,s.partialCstResult=l}throw s}}else{if(i)return this.moveToTerminatedState(),n(e);throw s}}else throw e}optionInternal(e,r){let n=this.getKeyForAutomaticLookahead(512,r);return this.optionInternalLogic(e,r,n)}optionInternalLogic(e,r,n){let i=this.getLaFuncFromCache(n),o;if(typeof e!="function"){o=e.DEF;let s=e.GATE;if(s!==void 0){let a=i;i=()=>s.call(this)&&a.call(this)}}else o=e;if(i.call(this)===!0)return o.call(this)}atLeastOneInternal(e,r){let n=this.getKeyForAutomaticLookahead(1024,e);return this.atLeastOneInternalLogic(e,r,n)}atLeastOneInternalLogic(e,r,n){let i=this.getLaFuncFromCache(n),o;if(typeof r!="function"){o=r.DEF;let s=r.GATE;if(s!==void 0){let a=i;i=()=>s.call(this)&&a.call(this)}}else o=r;if(i.call(this)===!0){let s=this.doSingleRepetition(o);for(;i.call(this)===!0&&s===!0;)s=this.doSingleRepetition(o)}else throw this.raiseEarlyExitException(e,mt.REPETITION_MANDATORY,r.ERR_MSG);this.attemptInRepetitionRecovery(this.atLeastOneInternal,[e,r],i,1024,e,gd)}atLeastOneSepFirstInternal(e,r){let n=this.getKeyForAutomaticLookahead(1536,e);this.atLeastOneSepFirstInternalLogic(e,r,n)}atLeastOneSepFirstInternalLogic(e,r,n){let i=r.DEF,o=r.SEP;if(this.getLaFuncFromCache(n).call(this)===!0){i.call(this);let a=()=>this.tokenMatcher(this.LA(1),o);for(;this.tokenMatcher(this.LA(1),o)===!0;)this.CONSUME(o),i.call(this);this.attemptInRepetitionRecovery(this.repetitionSepSecondInternal,[e,o,a,i,Hl],a,1536,e,Hl)}else throw this.raiseEarlyExitException(e,mt.REPETITION_MANDATORY_WITH_SEPARATOR,r.ERR_MSG)}manyInternal(e,r){let n=this.getKeyForAutomaticLookahead(768,e);return this.manyInternalLogic(e,r,n)}manyInternalLogic(e,r,n){let i=this.getLaFuncFromCache(n),o;if(typeof r!="function"){o=r.DEF;let a=r.GATE;if(a!==void 0){let l=i;i=()=>a.call(this)&&l.call(this)}}else o=r;let s=!0;for(;i.call(this)===!0&&s===!0;)s=this.doSingleRepetition(o);this.attemptInRepetitionRecovery(this.manyInternal,[e,r],i,768,e,hd,s)}manySepFirstInternal(e,r){let n=this.getKeyForAutomaticLookahead(1280,e);this.manySepFirstInternalLogic(e,r,n)}manySepFirstInternalLogic(e,r,n){let i=r.DEF,o=r.SEP;if(this.getLaFuncFromCache(n).call(this)===!0){i.call(this);let a=()=>this.tokenMatcher(this.LA(1),o);for(;this.tokenMatcher(this.LA(1),o)===!0;)this.CONSUME(o),i.call(this);this.attemptInRepetitionRecovery(this.repetitionSepSecondInternal,[e,o,a,i,ql],a,1280,e,ql)}}repetitionSepSecondInternal(e,r,n,i,o){for(;n();)this.CONSUME(r),i.call(this);this.attemptInRepetitionRecovery(this.repetitionSepSecondInternal,[e,r,n,i,o],n,1536,e,o)}doSingleRepetition(e){let r=this.getLexerPosition();return e.call(this),this.getLexerPosition()>r}orInternal(e,r){let n=this.getKeyForAutomaticLookahead(256,r),i=se(e)?e:e.DEF,s=this.getLaFuncFromCache(n).call(this,i);if(s!==void 0)return i[s].ALT.call(this);this.raiseNoAltException(r,e.ERR_MSG)}ruleFinallyStateUpdate(){if(this.RULE_STACK.pop(),this.RULE_OCCURRENCE_STACK.pop(),this.cstFinallyStateUpdate(),this.RULE_STACK.length===0&&this.isAtEndOfInput()===!1){let e=this.LA(1),r=this.errorMessageProvider.buildNotAllInputParsedMessage({firstRedundant:e,ruleName:this.getCurrRuleFullName()});this.SAVE_ERROR(new Xl(r,e))}}subruleInternal(e,r,n){let i;try{let o=n!==void 0?n.ARGS:void 0;return this.subruleIdx=r,i=e.apply(this,o),this.cstPostNonTerminal(i,n!==void 0&&n.LABEL!==void 0?n.LABEL:e.ruleName),i}catch(o){throw this.subruleInternalError(o,n,e.ruleName)}}subruleInternalError(e,r,n){throw so(e)&&e.partialCstResult!==void 0&&(this.cstPostNonTerminal(e.partialCstResult,r!==void 0&&r.LABEL!==void 0?r.LABEL:n),delete e.partialCstResult),e}consumeInternal(e,r,n){let i;try{let o=this.LA(1);this.tokenMatcher(o,e)===!0?(this.consumeToken(),i=o):this.consumeInternalError(e,o,n)}catch(o){i=this.consumeInternalRecovery(e,r,o)}return this.cstPostTerminal(n!==void 0&&n.LABEL!==void 0?n.LABEL:e.name,i),i}consumeInternalError(e,r,n){let i,o=this.LA(0);throw n!==void 0&&n.ERR_MSG?i=n.ERR_MSG:i=this.errorMessageProvider.buildMismatchTokenMessage({expected:e,actual:r,previous:o,ruleName:this.getCurrRuleFullName()}),this.SAVE_ERROR(new jo(i,r,o))}consumeInternalRecovery(e,r,n){if(this.recoveryEnabled&&n.name==="MismatchedTokenException"&&!this.isBackTracking()){let i=this.getFollowsForInRuleRecovery(e,r);try{return this.tryInRuleRecovery(e,i)}catch(o){throw o.name===QT?n:o}}else throw n}saveRecogState(){let e=this.errors,r=tt(this.RULE_STACK);return{errors:e,lexerState:this.exportLexerState(),RULE_STACK:r,CST_STACK:this.CST_STACK}}reloadRecogState(e){this.errors=e.errors,this.importLexerState(e.lexerState),this.RULE_STACK=e.RULE_STACK}ruleInvocationStateUpdate(e,r,n){this.RULE_OCCURRENCE_STACK.push(n),this.RULE_STACK.push(e),this.cstInvocationStateUpdate(r)}isBackTracking(){return this.isBackTrackingStack.length!==0}getCurrRuleFullName(){let e=this.getLastExplicitRuleShortName();return this.shortRuleNameToFull[e]}shortRuleNameToFullName(e){return this.shortRuleNameToFull[e]}isAtEndOfInput(){return this.tokenMatcher(this.LA(1),nn)}reset(){this.resetLexerState(),this.subruleIdx=0,this.isBackTrackingStack=[],this.errors=[],this.RULE_STACK=[],this.CST_STACK=[],this.RULE_OCCURRENCE_STACK=[]}};var wd=class{initErrorHandler(e){this._errors=[],this.errorMessageProvider=te(e,"errorMessageProvider")?e.errorMessageProvider:kr.errorMessageProvider}SAVE_ERROR(e){if(so(e))return e.context={ruleStack:this.getHumanReadableRuleStack(),ruleOccurrenceStack:tt(this.RULE_OCCURRENCE_STACK)},this._errors.push(e),e;throw Error("Trying to save an Error which is not a RecognitionException")}get errors(){return tt(this._errors)}set errors(e){this._errors=e}raiseEarlyExitException(e,r,n){let i=this.getCurrRuleFullName(),o=this.getGAstProductions()[i],a=Ca(e,o,r,this.maxLookahead)[0],l=[];for(let c=1;c<=this.maxLookahead;c++)l.push(this.LA(c));let u=this.errorMessageProvider.buildEarlyExitMessage({expectedIterationPaths:a,actual:l,previous:this.LA(0),customUserDescription:n,ruleName:i});throw this.SAVE_ERROR(new Jl(u,this.LA(1),this.LA(0)))}raiseNoAltException(e,r){let n=this.getCurrRuleFullName(),i=this.getGAstProductions()[n],o=Da(e,i,this.maxLookahead),s=[];for(let u=1;u<=this.maxLookahead;u++)s.push(this.LA(u));let a=this.LA(0),l=this.errorMessageProvider.buildNoViableAltMessage({expectedPathsPerAlt:o,actual:s,previous:a,customUserDescription:r,ruleName:this.getCurrRuleFullName()});throw this.SAVE_ERROR(new Yl(l,this.LA(1),a))}};var $d=class{initContentAssist(){}computeContentAssist(e,r){let n=this.gastProductionsCache[e];if(xr(n))throw Error(`Rule ->${e}<- does not exist in this grammar.`);return yd([n],r,this.tokenMatcher,this.maxLookahead)}getNextPossibleTokenTypes(e){let r=or(e.ruleStack),i=this.getGAstProductions()[r];return new md(i,e).startWalking()}};var Fd={description:"This Object indicates the Parser is during Recording Phase"};Object.freeze(Fd);var gS=!0,TS=Math.pow(2,8)-1,_S=pd({name:"RECORDING_PHASE_TOKEN",pattern:kt.NA});hi([_S]);var vS=Go(_S,`This IToken indicates the Parser is in Recording Phase
	See: https://chevrotain.io/docs/guide/internals.html#grammar-recording for details`,-1,-1,-1,-1,-1,-1);Object.freeze(vS);var TB={name:`This CSTNode indicates the Parser is in Recording Phase
	See: https://chevrotain.io/docs/guide/internals.html#grammar-recording for details`,children:{}},Pd=class{initGastRecorder(e){this.recordingProdStack=[],this.RECORDING_PHASE=!1}enableRecording(){this.RECORDING_PHASE=!0,this.TRACE_INIT("Enable Recording",()=>{for(let e=0;e<10;e++){let r=e>0?e:"";this[`CONSUME${r}`]=function(n,i){return this.consumeInternalRecord(n,e,i)},this[`SUBRULE${r}`]=function(n,i){return this.subruleInternalRecord(n,e,i)},this[`OPTION${r}`]=function(n){return this.optionInternalRecord(n,e)},this[`OR${r}`]=function(n){return this.orInternalRecord(n,e)},this[`MANY${r}`]=function(n){this.manyInternalRecord(e,n)},this[`MANY_SEP${r}`]=function(n){this.manySepFirstInternalRecord(e,n)},this[`AT_LEAST_ONE${r}`]=function(n){this.atLeastOneInternalRecord(e,n)},this[`AT_LEAST_ONE_SEP${r}`]=function(n){this.atLeastOneSepFirstInternalRecord(e,n)}}this.consume=function(e,r,n){return this.consumeInternalRecord(r,e,n)},this.subrule=function(e,r,n){return this.subruleInternalRecord(r,e,n)},this.option=function(e,r){return this.optionInternalRecord(r,e)},this.or=function(e,r){return this.orInternalRecord(r,e)},this.many=function(e,r){this.manyInternalRecord(e,r)},this.atLeastOne=function(e,r){this.atLeastOneInternalRecord(e,r)},this.ACTION=this.ACTION_RECORD,this.BACKTRACK=this.BACKTRACK_RECORD,this.LA=this.LA_RECORD})}disableRecording(){this.RECORDING_PHASE=!1,this.TRACE_INIT("Deleting Recording methods",()=>{let e=this;for(let r=0;r<10;r++){let n=r>0?r:"";delete e[`CONSUME${n}`],delete e[`SUBRULE${n}`],delete e[`OPTION${n}`],delete e[`OR${n}`],delete e[`MANY${n}`],delete e[`MANY_SEP${n}`],delete e[`AT_LEAST_ONE${n}`],delete e[`AT_LEAST_ONE_SEP${n}`]}delete e.consume,delete e.subrule,delete e.option,delete e.or,delete e.many,delete e.atLeastOne,delete e.ACTION,delete e.BACKTRACK,delete e.LA})}ACTION_RECORD(e){}BACKTRACK_RECORD(e,r){return()=>!0}LA_RECORD(e){return La}topLevelRuleRecord(e,r){try{let n=new br({definition:[],name:e});return n.name=e,this.recordingProdStack.push(n),r.call(this),this.recordingProdStack.pop(),n}catch(n){if(n.KNOWN_RECORDER_ERROR!==!0)try{n.message=n.message+`
	 This error was thrown during the "grammar recording phase" For more info see:
	https://chevrotain.io/docs/guide/internals.html#grammar-recording`}catch{throw n}throw n}}optionInternalRecord(e,r){return Zl.call(this,Ue,e,r)}atLeastOneInternalRecord(e,r){Zl.call(this,nt,r,e)}atLeastOneSepFirstInternalRecord(e,r){Zl.call(this,it,r,e,gS)}manyInternalRecord(e,r){Zl.call(this,Oe,r,e)}manySepFirstInternalRecord(e,r){Zl.call(this,Ke,r,e,gS)}orInternalRecord(e,r){return yB.call(this,e,r)}subruleInternalRecord(e,r,n){if(Md(r),!e||te(e,"ruleName")===!1){let a=new Error(`<SUBRULE${yS(r)}> argument is invalid expecting a Parser method reference but got: <${JSON.stringify(e)}>
 inside top level rule: <${this.recordingProdStack[0].name}>`);throw a.KNOWN_RECORDER_ERROR=!0,a}let i=zn(this.recordingProdStack),o=e.ruleName,s=new Fe({idx:r,nonTerminalName:o,label:n==null?void 0:n.LABEL,referencedRule:void 0});return i.definition.push(s),this.outputCst?TB:Fd}consumeInternalRecord(e,r,n){if(Md(r),!VT(e)){let s=new Error(`<CONSUME${yS(r)}> argument is invalid expecting a TokenType reference but got: <${JSON.stringify(e)}>
 inside top level rule: <${this.recordingProdStack[0].name}>`);throw s.KNOWN_RECORDER_ERROR=!0,s}let i=zn(this.recordingProdStack),o=new Re({idx:r,terminalType:e,label:n==null?void 0:n.LABEL});return i.definition.push(o),vS}};function Zl(t,e,r,n=!1){Md(r);let i=zn(this.recordingProdStack),o=Cr(e)?e:e.DEF,s=new t({definition:[],idx:r});return n&&(s.separator=e.SEP),te(e,"MAX_LOOKAHEAD")&&(s.maxLookahead=e.MAX_LOOKAHEAD),this.recordingProdStack.push(s),o.call(this),i.definition.push(s),this.recordingProdStack.pop(),Fd}function yB(t,e){Md(e);let r=zn(this.recordingProdStack),n=se(t)===!1,i=n===!1?t:t.DEF,o=new ze({definition:[],idx:e,ignoreAmbiguities:n&&t.IGNORE_AMBIGUITIES===!0});te(t,"MAX_LOOKAHEAD")&&(o.maxLookahead=t.MAX_LOOKAHEAD);let s=Fl(i,a=>Cr(a.GATE));return o.hasPredicates=s,r.definition.push(o),Z(i,a=>{let l=new rt({definition:[]});o.definition.push(l),te(a,"IGNORE_AMBIGUITIES")?l.ignoreAmbiguities=a.IGNORE_AMBIGUITIES:te(a,"GATE")&&(l.ignoreAmbiguities=!0),this.recordingProdStack.push(l),a.ALT.call(this),this.recordingProdStack.pop()}),Fd}function yS(t){return t===0?"":`${t}`}function Md(t){if(t<0||t>TS){let e=new Error(`Invalid DSL Method idx value: <${t}>
	Idx value must be a none negative value smaller than ${TS+1}`);throw e.KNOWN_RECORDER_ERROR=!0,e}}var Ud=class{initPerformanceTracer(e){if(te(e,"traceInitPerf")){let r=e.traceInitPerf,n=typeof r=="number";this.traceInitMaxIdent=n?r:1/0,this.traceInitPerf=n?r>0:r}else this.traceInitMaxIdent=0,this.traceInitPerf=kr.traceInitPerf;this.traceInitIndent=-1}TRACE_INIT(e,r){if(this.traceInitPerf===!0){this.traceInitIndent++;let n=new Array(this.traceInitIndent+1).join("	");this.traceInitIndent<this.traceInitMaxIdent&&console.log(`${n}--> <${e}>`);let{time:i,value:o}=Vl(r),s=i>10?console.warn:console.log;return this.traceInitIndent<this.traceInitMaxIdent&&s(`${n}<-- <${e}> time: ${i}ms`),this.traceInitIndent--,o}else return r()}};function RS(t,e){e.forEach(r=>{let n=r.prototype;Object.getOwnPropertyNames(n).forEach(i=>{if(i==="constructor")return;let o=Object.getOwnPropertyDescriptor(n,i);o&&(o.get||o.set)?Object.defineProperty(t.prototype,i,o):t.prototype[i]=r.prototype[i]})})}var La=Go(nn,"",NaN,NaN,NaN,NaN,NaN,NaN);Object.freeze(La);var kr=Object.freeze({recoveryEnabled:!1,maxLookahead:3,dynamicTokensEnabled:!1,outputCst:!0,errorMessageProvider:Ti,nodeLocationTracking:"none",traceInitPerf:!1,skipValidations:!1}),ka=Object.freeze({recoveryValueFunc:()=>{},resyncEnabled:!0}),er;(function(t){t[t.INVALID_RULE_NAME=0]="INVALID_RULE_NAME",t[t.DUPLICATE_RULE_NAME=1]="DUPLICATE_RULE_NAME",t[t.INVALID_RULE_OVERRIDE=2]="INVALID_RULE_OVERRIDE",t[t.DUPLICATE_PRODUCTIONS=3]="DUPLICATE_PRODUCTIONS",t[t.UNRESOLVED_SUBRULE_REF=4]="UNRESOLVED_SUBRULE_REF",t[t.LEFT_RECURSION=5]="LEFT_RECURSION",t[t.NONE_LAST_EMPTY_ALT=6]="NONE_LAST_EMPTY_ALT",t[t.AMBIGUOUS_ALTS=7]="AMBIGUOUS_ALTS",t[t.CONFLICT_TOKENS_RULES_NAMESPACE=8]="CONFLICT_TOKENS_RULES_NAMESPACE",t[t.INVALID_TOKEN_NAME=9]="INVALID_TOKEN_NAME",t[t.NO_NON_EMPTY_LOOKAHEAD=10]="NO_NON_EMPTY_LOOKAHEAD",t[t.AMBIGUOUS_PREFIX_ALTS=11]="AMBIGUOUS_PREFIX_ALTS",t[t.TOO_MANY_ALTS=12]="TOO_MANY_ALTS",t[t.CUSTOM_LOOKAHEAD_VALIDATION=13]="CUSTOM_LOOKAHEAD_VALIDATION"})(er||(er={}));function Vd(t=void 0){return function(){return t}}var eu=class t{static performSelfAnalysis(e){throw Error("The **static** `performSelfAnalysis` method has been deprecated.	\nUse the **instance** method with the same name instead.")}performSelfAnalysis(){this.TRACE_INIT("performSelfAnalysis",()=>{let e;this.selfAnalysisDone=!0;let r=this.className;this.TRACE_INIT("toFastProps",()=>{Bl(this)}),this.TRACE_INIT("Grammar Recording",()=>{try{this.enableRecording(),Z(this.definedRulesNames,i=>{let s=this[i].originalGrammarAction,a;this.TRACE_INIT(`${i} Rule`,()=>{a=this.topLevelRuleRecord(i,s)}),this.gastProductionsCache[i]=a})}finally{this.disableRecording()}});let n=[];if(this.TRACE_INIT("Grammar Resolving",()=>{n=oS({rules:We(this.gastProductionsCache)}),this.definitionErrors=this.definitionErrors.concat(n)}),this.TRACE_INIT("Grammar Validations",()=>{if(ve(n)&&this.skipValidations===!1){let i=sS({rules:We(this.gastProductionsCache),tokenTypes:We(this.tokensMap),errMsgProvider:Sn,grammarName:r}),o=QA({lookaheadStrategy:this.lookaheadStrategy,rules:We(this.gastProductionsCache),tokenTypes:We(this.tokensMap),grammarName:r});this.definitionErrors=this.definitionErrors.concat(i,o)}}),ve(this.definitionErrors)&&(this.recoveryEnabled&&this.TRACE_INIT("computeAllProdsFollows",()=>{let i=pA(We(this.gastProductionsCache));this.resyncFollows=i}),this.TRACE_INIT("ComputeLookaheadFunctions",()=>{var i,o;(o=(i=this.lookaheadStrategy).initialize)===null||o===void 0||o.call(i,{rules:We(this.gastProductionsCache)}),this.preComputeLookaheadFunctions(We(this.gastProductionsCache))})),!t.DEFER_DEFINITION_ERRORS_HANDLING&&!ve(this.definitionErrors))throw e=K(this.definitionErrors,i=>i.message),new Error(`Parser Definition Errors detected:
 ${e.join(`
-------------------------------
`)}`)})}constructor(e,r){this.definitionErrors=[],this.selfAnalysisDone=!1;let n=this;if(n.initErrorHandler(r),n.initLexerAdapter(),n.initLooksAhead(r),n.initRecognizerEngine(e,r),n.initRecoverable(r),n.initTreeBuilder(r),n.initContentAssist(),n.initGastRecorder(r),n.initPerformanceTracer(r),te(r,"ignoredIssues"))throw new Error(`The <ignoredIssues> IParserConfig property has been deprecated.
	Please use the <IGNORE_AMBIGUITIES> flag on the relevant DSL method instead.
	See: https://chevrotain.io/docs/guide/resolving_grammar_errors.html#IGNORING_AMBIGUITIES
	For further details.`);this.skipValidations=te(r,"skipValidations")?r.skipValidations:kr.skipValidations}};eu.DEFER_DEFINITION_ERRORS_HANDLING=!1;RS(eu,[Nd,Od,Cd,bd,kd,Ld,wd,$d,Pd,Ud]);var tu=class extends eu{constructor(e,r=kr){let n=tt(r);n.outputCst=!1,super(e,n)}};function qo(t,e,r){return`${t.name}_${e}_${r}`}var ao=1,vB=2,xS=4,NS=5;var Pa=7,RB=8,xB=9,NB=10,EB=11,ES=12,ru=class{constructor(e){this.target=e}isEpsilon(){return!1}},wa=class extends ru{constructor(e,r){super(e),this.tokenType=r}},nu=class extends ru{constructor(e){super(e)}isEpsilon(){return!0}},$a=class extends ru{constructor(e,r,n){super(e),this.rule=r,this.followState=n}isEpsilon(){return!0}};function IS(t){let e={decisionMap:{},decisionStates:[],ruleToStartState:new Map,ruleToStopState:new Map,states:[]};IB(e,t);let r=t.length;for(let n=0;n<r;n++){let i=t[n],o=Ho(e,i,i);o!==void 0&&PB(e,i,o)}return e}function IB(t,e){let r=e.length;for(let n=0;n<r;n++){let i=e[n],o=sr(t,i,void 0,{type:vB}),s=sr(t,i,void 0,{type:Pa});o.stop=s,t.ruleToStartState.set(i,o),t.ruleToStopState.set(i,s)}}function OS(t,e,r){return r instanceof Re?ay(t,e,r.terminalType,r):r instanceof Fe?$B(t,e,r):r instanceof ze?CB(t,e,r):r instanceof Ue?bB(t,e,r):r instanceof Oe?OB(t,e,r):r instanceof Ke?AB(t,e,r):r instanceof nt?SB(t,e,r):r instanceof it?DB(t,e,r):Ho(t,e,r)}function OB(t,e,r){let n=sr(t,e,r,{type:NS});lo(t,n);let i=Ma(t,e,n,r,Ho(t,e,r));return SS(t,e,r,i)}function AB(t,e,r){let n=sr(t,e,r,{type:NS});lo(t,n);let i=Ma(t,e,n,r,Ho(t,e,r)),o=ay(t,e,r.separator,r);return SS(t,e,r,i,o)}function SB(t,e,r){let n=sr(t,e,r,{type:xS});lo(t,n);let i=Ma(t,e,n,r,Ho(t,e,r));return AS(t,e,r,i)}function DB(t,e,r){let n=sr(t,e,r,{type:xS});lo(t,n);let i=Ma(t,e,n,r,Ho(t,e,r)),o=ay(t,e,r.separator,r);return AS(t,e,r,i,o)}function CB(t,e,r){let n=sr(t,e,r,{type:ao});lo(t,n);let i=K(r.definition,s=>OS(t,e,s));return Ma(t,e,n,r,...i)}function bB(t,e,r){let n=sr(t,e,r,{type:ao});lo(t,n);let i=Ma(t,e,n,r,Ho(t,e,r));return LB(t,e,r,i)}function Ho(t,e,r){let n=ir(K(r.definition,i=>OS(t,e,i)),i=>i!==void 0);return n.length===1?n[0]:n.length===0?void 0:wB(t,n)}function AS(t,e,r,n,i){let o=n.left,s=n.right,a=sr(t,e,r,{type:EB});lo(t,a);let l=sr(t,e,r,{type:ES});return o.loopback=a,l.loopback=a,t.decisionMap[qo(e,i?"RepetitionMandatoryWithSeparator":"RepetitionMandatory",r.idx)]=a,zt(s,a),i===void 0?(zt(a,o),zt(a,l)):(zt(a,l),zt(a,i.left),zt(i.right,o)),{left:o,right:l}}function SS(t,e,r,n,i){let o=n.left,s=n.right,a=sr(t,e,r,{type:NB});lo(t,a);let l=sr(t,e,r,{type:ES}),u=sr(t,e,r,{type:xB});return a.loopback=u,l.loopback=u,zt(a,o),zt(a,l),zt(s,u),i!==void 0?(zt(u,l),zt(u,i.left),zt(i.right,o)):zt(u,a),t.decisionMap[qo(e,i?"RepetitionWithSeparator":"Repetition",r.idx)]=a,{left:a,right:l}}function LB(t,e,r,n){let i=n.left,o=n.right;return zt(i,o),t.decisionMap[qo(e,"Option",r.idx)]=i,n}function lo(t,e){return t.decisionStates.push(e),e.decision=t.decisionStates.length-1,e.decision}function Ma(t,e,r,n,...i){let o=sr(t,e,n,{type:RB,start:r});r.end=o;for(let a of i)a!==void 0?(zt(r,a.left),zt(a.right,o)):zt(r,o);let s={left:r,right:o};return t.decisionMap[qo(e,kB(n),n.idx)]=r,s}function kB(t){if(t instanceof ze)return"Alternation";if(t instanceof Ue)return"Option";if(t instanceof Oe)return"Repetition";if(t instanceof Ke)return"RepetitionWithSeparator";if(t instanceof nt)return"RepetitionMandatory";if(t instanceof it)return"RepetitionMandatoryWithSeparator";throw new Error("Invalid production type encountered")}function wB(t,e){let r=e.length;for(let o=0;o<r-1;o++){let s=e[o],a;s.left.transitions.length===1&&(a=s.left.transitions[0]);let l=a instanceof $a,u=a,c=e[o+1].left;s.left.type===ao&&s.right.type===ao&&a!==void 0&&(l&&u.followState===s.right||a.target===s.right)?(l?u.followState=c:a.target=c,MB(t,s.right)):zt(s.right,c)}let n=e[0],i=e[r-1];return{left:n.left,right:i.right}}function ay(t,e,r,n){let i=sr(t,e,n,{type:ao}),o=sr(t,e,n,{type:ao});return ly(i,new wa(o,r)),{left:i,right:o}}function $B(t,e,r){let n=r.referencedRule,i=t.ruleToStartState.get(n),o=sr(t,e,r,{type:ao}),s=sr(t,e,r,{type:ao}),a=new $a(i,n,s);return ly(o,a),{left:o,right:s}}function PB(t,e,r){let n=t.ruleToStartState.get(e);zt(n,r.left);let i=t.ruleToStopState.get(e);return zt(r.right,i),{left:n,right:i}}function zt(t,e){let r=new nu(e);ly(t,r)}function sr(t,e,r,n){let i=Object.assign({atn:t,production:r,epsilonOnlyTransitions:!1,rule:e,transitions:[],nextTokenWithinRule:[],stateNumber:t.states.length},n);return t.states.push(i),i}function ly(t,e){t.transitions.length===0&&(t.epsilonOnlyTransitions=e.isEpsilon()),t.transitions.push(e)}function MB(t,e){t.states.splice(t.states.indexOf(e),1)}var iu={},Fa=class{constructor(){this.map={},this.configs=[]}get size(){return this.configs.length}finalize(){this.map={}}add(e){let r=uy(e);r in this.map||(this.map[r]=this.configs.length,this.configs.push(e))}get elements(){return this.configs}get alts(){return K(this.configs,e=>e.alt)}get key(){let e="";for(let r in this.map)e+=r+":";return e}};function uy(t,e=!0){return`${e?`a${t.alt}`:""}s${t.state.stateNumber}:${t.stack.map(r=>r.stateNumber.toString()).join("_")}`}function FB(t,e){let r={};return n=>{let i=n.toString(),o=r[i];return o!==void 0||(o={atnStartState:t,decision:e,states:{}},r[i]=o),o}}var Bd=class{constructor(){this.predicates=[]}is(e){return e>=this.predicates.length||this.predicates[e]}set(e,r){this.predicates[e]=r}toString(){let e="",r=this.predicates.length;for(let n=0;n<r;n++)e+=this.predicates[n]===!0?"1":"0";return e}},DS=new Bd,ou=class extends yi{constructor(e){var r;super(),this.logging=(r=e==null?void 0:e.logging)!==null&&r!==void 0?r:n=>console.log(n)}initialize(e){this.atn=IS(e.rules),this.dfas=UB(this.atn)}validateAmbiguousAlternationAlternatives(){return[]}validateEmptyOrAlternatives(){return[]}buildLookaheadForAlternation(e){let{prodOccurrence:r,rule:n,hasPredicates:i,dynamicTokensEnabled:o}=e,s=this.dfas,a=this.logging,l=qo(n,"Alternation",r),c=this.atn.decisionMap[l].decision,f=K(vd({maxLookahead:1,occurrence:r,prodType:"Alternation",rule:n}),d=>K(d,m=>m[0]));if(CS(f,!1)&&!o){let d=It(f,(m,_,x)=>(Z(_,A=>{A&&(m[A.tokenTypeIdx]=x,Z(A.categoryMatches,I=>{m[I]=x}))}),m),{});return i?function(m){var _;let x=this.LA(1),A=d[x.tokenTypeIdx];if(m!==void 0&&A!==void 0){let I=(_=m[A])===null||_===void 0?void 0:_.GATE;if(I!==void 0&&I.call(this)===!1)return}return A}:function(){let m=this.LA(1);return d[m.tokenTypeIdx]}}else return i?function(d){let m=new Bd,_=d===void 0?0:d.length;for(let A=0;A<_;A++){let I=d==null?void 0:d[A].GATE;m.set(A,I===void 0||I.call(this))}let x=cy.call(this,s,c,m,a);return typeof x=="number"?x:void 0}:function(){let d=cy.call(this,s,c,DS,a);return typeof d=="number"?d:void 0}}buildLookaheadForOptional(e){let{prodOccurrence:r,rule:n,prodType:i,dynamicTokensEnabled:o}=e,s=this.dfas,a=this.logging,l=qo(n,i,r),c=this.atn.decisionMap[l].decision,f=K(vd({maxLookahead:1,occurrence:r,prodType:i,rule:n}),d=>K(d,m=>m[0]));if(CS(f)&&f[0][0]&&!o){let d=f[0],m=Wt(d);if(m.length===1&&ve(m[0].categoryMatches)){let x=m[0].tokenTypeIdx;return function(){return this.LA(1).tokenTypeIdx===x}}else{let _=It(m,(x,A)=>(A!==void 0&&(x[A.tokenTypeIdx]=!0,Z(A.categoryMatches,I=>{x[I]=!0})),x),{});return function(){let x=this.LA(1);return _[x.tokenTypeIdx]===!0}}}return function(){let d=cy.call(this,s,c,DS,a);return typeof d=="object"?!1:d===0}}};function CS(t,e=!0){let r=new Set;for(let n of t){let i=new Set;for(let o of n){if(o===void 0){if(e)break;return!1}let s=[o.tokenTypeIdx].concat(o.categoryMatches);for(let a of s)if(r.has(a)){if(!i.has(a))return!1}else r.add(a),i.add(a)}}return!0}function UB(t){let e=t.decisionStates.length,r=Array(e);for(let n=0;n<e;n++)r[n]=FB(t.decisionStates[n],n);return r}function cy(t,e,r,n){let i=t[e](r),o=i.start;if(o===void 0){let a=XB(i.atnStartState);o=kS(i,LS(a)),i.start=o}return VB.apply(this,[i,o,r,n])}function VB(t,e,r,n){let i=e,o=1,s=[],a=this.LA(o++);for(;;){let l=HB(i,a);if(l===void 0&&(l=BB.apply(this,[t,i,a,o,r,n])),l===iu)return qB(s,i,a);if(l.isAcceptState===!0)return l.prediction;i=l,s.push(a),a=this.LA(o++)}}function BB(t,e,r,n,i,o){let s=KB(e.configs,r,i);if(s.size===0)return bS(t,e,r,iu),iu;let a=LS(s),l=YB(s,i);if(l!==void 0)a.isAcceptState=!0,a.prediction=l,a.configs.uniqueAlt=l;else if(eW(s)){let u=iA(s.alts);a.isAcceptState=!0,a.prediction=u,a.configs.uniqueAlt=u,WB.apply(this,[t,n,s.alts,o])}return a=bS(t,e,r,a),a}function WB(t,e,r,n){let i=[];for(let u=1;u<=e;u++)i.push(this.LA(u).tokenType);let o=t.atnStartState,s=o.rule,a=o.production,l=GB({topLevelRule:s,ambiguityIndices:r,production:a,prefixPath:i});n(l)}function GB(t){let e=K(t.prefixPath,i=>gi(i)).join(", "),r=t.production.idx===0?"":t.production.idx,n=`Ambiguous Alternatives Detected: <${t.ambiguityIndices.join(", ")}> in <${jB(t.production)}${r}> inside <${t.topLevelRule.name}> Rule,
<${e}> may appears as a prefix path in all these alternatives.
`;return n=n+`See: https://chevrotain.io/docs/guide/resolving_grammar_errors.html#AMBIGUOUS_ALTERNATIVES
For Further details.`,n}function jB(t){if(t instanceof Fe)return"SUBRULE";if(t instanceof Ue)return"OPTION";if(t instanceof ze)return"OR";if(t instanceof nt)return"AT_LEAST_ONE";if(t instanceof it)return"AT_LEAST_ONE_SEP";if(t instanceof Ke)return"MANY_SEP";if(t instanceof Oe)return"MANY";if(t instanceof Re)return"CONSUME";throw Error("non exhaustive match")}function qB(t,e,r){let n=dr(e.configs.elements,o=>o.state.transitions),i=fA(n.filter(o=>o instanceof wa).map(o=>o.tokenType),o=>o.tokenTypeIdx);return{actualToken:r,possibleTokenTypes:i,tokenPath:t}}function HB(t,e){return t.edges[e.tokenTypeIdx]}function KB(t,e,r){let n=new Fa,i=[];for(let s of t.elements){if(r.is(s.alt)===!1)continue;if(s.state.type===Pa){i.push(s);continue}let a=s.state.transitions.length;for(let l=0;l<a;l++){let u=s.state.transitions[l],c=zB(u,e);c!==void 0&&n.add({state:c,alt:s.alt,stack:s.stack})}}let o;if(i.length===0&&n.size===1&&(o=n),o===void 0){o=new Fa;for(let s of n.elements)Wd(s,o)}if(i.length>0&&!QB(o))for(let s of i)o.add(s);return o}function zB(t,e){if(t instanceof wa&&jl(e,t.tokenType))return t.target}function YB(t,e){let r;for(let n of t.elements)if(e.is(n.alt)===!0){if(r===void 0)r=n.alt;else if(r!==n.alt)return}return r}function LS(t){return{configs:t,edges:{},isAcceptState:!1,prediction:-1}}function bS(t,e,r,n){return n=kS(t,n),e.edges[r.tokenTypeIdx]=n,n}function kS(t,e){if(e===iu)return e;let r=e.configs.key,n=t.states[r];return n!==void 0?n:(e.configs.finalize(),t.states[r]=e,e)}function XB(t){let e=new Fa,r=t.transitions.length;for(let n=0;n<r;n++){let o={state:t.transitions[n].target,alt:n,stack:[]};Wd(o,e)}return e}function Wd(t,e){let r=t.state;if(r.type===Pa){if(t.stack.length>0){let i=[...t.stack],s={state:i.pop(),alt:t.alt,stack:i};Wd(s,e)}else e.add(t);return}r.epsilonOnlyTransitions||e.add(t);let n=r.transitions.length;for(let i=0;i<n;i++){let o=r.transitions[i],s=JB(t,o);s!==void 0&&Wd(s,e)}}function JB(t,e){if(e instanceof nu)return{state:e.target,alt:t.alt,stack:t.stack};if(e instanceof $a){let r=[...t.stack,e.followState];return{state:e.target,alt:t.alt,stack:r}}}function QB(t){for(let e of t.elements)if(e.state.type===Pa)return!0;return!1}function ZB(t){for(let e of t.elements)if(e.state.type!==Pa)return!1;return!0}function eW(t){if(ZB(t))return!0;let e=tW(t.elements);return rW(e)&&!nW(e)}function tW(t){let e=new Map;for(let r of t){let n=uy(r,!1),i=e.get(n);i===void 0&&(i={},e.set(n,i)),i[r.alt]=!0}return e}function rW(t){for(let e of Array.from(t.values()))if(Object.keys(e).length>1)return!0;return!1}function nW(t){for(let e of Array.from(t.values()))if(Object.keys(e).length===1)return!0;return!1}var wS;(function(t){function e(r){return typeof r=="string"}t.is=e})(wS||(wS={}));var fy;(function(t){function e(r){return typeof r=="string"}t.is=e})(fy||(fy={}));var $S;(function(t){t.MIN_VALUE=-2147483648,t.MAX_VALUE=2147483647;function e(r){return typeof r=="number"&&t.MIN_VALUE<=r&&r<=t.MAX_VALUE}t.is=e})($S||($S={}));var Gd;(function(t){t.MIN_VALUE=0,t.MAX_VALUE=2147483647;function e(r){return typeof r=="number"&&t.MIN_VALUE<=r&&r<=t.MAX_VALUE}t.is=e})(Gd||(Gd={}));var ke;(function(t){function e(n,i){return n===Number.MAX_VALUE&&(n=Gd.MAX_VALUE),i===Number.MAX_VALUE&&(i=Gd.MAX_VALUE),{line:n,character:i}}t.create=e;function r(n){let i=n;return b.objectLiteral(i)&&b.uinteger(i.line)&&b.uinteger(i.character)}t.is=r})(ke||(ke={}));var Ae;(function(t){function e(n,i,o,s){if(b.uinteger(n)&&b.uinteger(i)&&b.uinteger(o)&&b.uinteger(s))return{start:ke.create(n,i),end:ke.create(o,s)};if(ke.is(n)&&ke.is(i))return{start:n,end:i};throw new Error(`Range#create called with invalid arguments[${n}, ${i}, ${o}, ${s}]`)}t.create=e;function r(n){let i=n;return b.objectLiteral(i)&&ke.is(i.start)&&ke.is(i.end)}t.is=r})(Ae||(Ae={}));var jd;(function(t){function e(n,i){return{uri:n,range:i}}t.create=e;function r(n){let i=n;return b.objectLiteral(i)&&Ae.is(i.range)&&(b.string(i.uri)||b.undefined(i.uri))}t.is=r})(jd||(jd={}));var PS;(function(t){function e(n,i,o,s){return{targetUri:n,targetRange:i,targetSelectionRange:o,originSelectionRange:s}}t.create=e;function r(n){let i=n;return b.objectLiteral(i)&&Ae.is(i.targetRange)&&b.string(i.targetUri)&&Ae.is(i.targetSelectionRange)&&(Ae.is(i.originSelectionRange)||b.undefined(i.originSelectionRange))}t.is=r})(PS||(PS={}));var dy;(function(t){function e(n,i,o,s){return{red:n,green:i,blue:o,alpha:s}}t.create=e;function r(n){let i=n;return b.objectLiteral(i)&&b.numberRange(i.red,0,1)&&b.numberRange(i.green,0,1)&&b.numberRange(i.blue,0,1)&&b.numberRange(i.alpha,0,1)}t.is=r})(dy||(dy={}));var MS;(function(t){function e(n,i){return{range:n,color:i}}t.create=e;function r(n){let i=n;return b.objectLiteral(i)&&Ae.is(i.range)&&dy.is(i.color)}t.is=r})(MS||(MS={}));var FS;(function(t){function e(n,i,o){return{label:n,textEdit:i,additionalTextEdits:o}}t.create=e;function r(n){let i=n;return b.objectLiteral(i)&&b.string(i.label)&&(b.undefined(i.textEdit)||uo.is(i))&&(b.undefined(i.additionalTextEdits)||b.typedArray(i.additionalTextEdits,uo.is))}t.is=r})(FS||(FS={}));var US;(function(t){t.Comment="comment",t.Imports="imports",t.Region="region"})(US||(US={}));var VS;(function(t){function e(n,i,o,s,a,l){let u={startLine:n,endLine:i};return b.defined(o)&&(u.startCharacter=o),b.defined(s)&&(u.endCharacter=s),b.defined(a)&&(u.kind=a),b.defined(l)&&(u.collapsedText=l),u}t.create=e;function r(n){let i=n;return b.objectLiteral(i)&&b.uinteger(i.startLine)&&b.uinteger(i.startLine)&&(b.undefined(i.startCharacter)||b.uinteger(i.startCharacter))&&(b.undefined(i.endCharacter)||b.uinteger(i.endCharacter))&&(b.undefined(i.kind)||b.string(i.kind))}t.is=r})(VS||(VS={}));var py;(function(t){function e(n,i){return{location:n,message:i}}t.create=e;function r(n){let i=n;return b.defined(i)&&jd.is(i.location)&&b.string(i.message)}t.is=r})(py||(py={}));var BS;(function(t){t.Error=1,t.Warning=2,t.Information=3,t.Hint=4})(BS||(BS={}));var WS;(function(t){t.Unnecessary=1,t.Deprecated=2})(WS||(WS={}));var GS;(function(t){function e(r){let n=r;return b.objectLiteral(n)&&b.string(n.href)}t.is=e})(GS||(GS={}));var qd;(function(t){function e(n,i,o,s,a,l){let u={range:n,message:i};return b.defined(o)&&(u.severity=o),b.defined(s)&&(u.code=s),b.defined(a)&&(u.source=a),b.defined(l)&&(u.relatedInformation=l),u}t.create=e;function r(n){var i;let o=n;return b.defined(o)&&Ae.is(o.range)&&b.string(o.message)&&(b.number(o.severity)||b.undefined(o.severity))&&(b.integer(o.code)||b.string(o.code)||b.undefined(o.code))&&(b.undefined(o.codeDescription)||b.string((i=o.codeDescription)===null||i===void 0?void 0:i.href))&&(b.string(o.source)||b.undefined(o.source))&&(b.undefined(o.relatedInformation)||b.typedArray(o.relatedInformation,py.is))}t.is=r})(qd||(qd={}));var Ua;(function(t){function e(n,i,...o){let s={title:n,command:i};return b.defined(o)&&o.length>0&&(s.arguments=o),s}t.create=e;function r(n){let i=n;return b.defined(i)&&b.string(i.title)&&b.string(i.command)}t.is=r})(Ua||(Ua={}));var uo;(function(t){function e(o,s){return{range:o,newText:s}}t.replace=e;function r(o,s){return{range:{start:o,end:o},newText:s}}t.insert=r;function n(o){return{range:o,newText:""}}t.del=n;function i(o){let s=o;return b.objectLiteral(s)&&b.string(s.newText)&&Ae.is(s.range)}t.is=i})(uo||(uo={}));var my;(function(t){function e(n,i,o){let s={label:n};return i!==void 0&&(s.needsConfirmation=i),o!==void 0&&(s.description=o),s}t.create=e;function r(n){let i=n;return b.objectLiteral(i)&&b.string(i.label)&&(b.boolean(i.needsConfirmation)||i.needsConfirmation===void 0)&&(b.string(i.description)||i.description===void 0)}t.is=r})(my||(my={}));var Va;(function(t){function e(r){let n=r;return b.string(n)}t.is=e})(Va||(Va={}));var jS;(function(t){function e(o,s,a){return{range:o,newText:s,annotationId:a}}t.replace=e;function r(o,s,a){return{range:{start:o,end:o},newText:s,annotationId:a}}t.insert=r;function n(o,s){return{range:o,newText:"",annotationId:s}}t.del=n;function i(o){let s=o;return uo.is(s)&&(my.is(s.annotationId)||Va.is(s.annotationId))}t.is=i})(jS||(jS={}));var hy;(function(t){function e(n,i){return{textDocument:n,edits:i}}t.create=e;function r(n){let i=n;return b.defined(i)&&vy.is(i.textDocument)&&Array.isArray(i.edits)}t.is=r})(hy||(hy={}));var gy;(function(t){function e(n,i,o){let s={kind:"create",uri:n};return i!==void 0&&(i.overwrite!==void 0||i.ignoreIfExists!==void 0)&&(s.options=i),o!==void 0&&(s.annotationId=o),s}t.create=e;function r(n){let i=n;return i&&i.kind==="create"&&b.string(i.uri)&&(i.options===void 0||(i.options.overwrite===void 0||b.boolean(i.options.overwrite))&&(i.options.ignoreIfExists===void 0||b.boolean(i.options.ignoreIfExists)))&&(i.annotationId===void 0||Va.is(i.annotationId))}t.is=r})(gy||(gy={}));var Ty;(function(t){function e(n,i,o,s){let a={kind:"rename",oldUri:n,newUri:i};return o!==void 0&&(o.overwrite!==void 0||o.ignoreIfExists!==void 0)&&(a.options=o),s!==void 0&&(a.annotationId=s),a}t.create=e;function r(n){let i=n;return i&&i.kind==="rename"&&b.string(i.oldUri)&&b.string(i.newUri)&&(i.options===void 0||(i.options.overwrite===void 0||b.boolean(i.options.overwrite))&&(i.options.ignoreIfExists===void 0||b.boolean(i.options.ignoreIfExists)))&&(i.annotationId===void 0||Va.is(i.annotationId))}t.is=r})(Ty||(Ty={}));var yy;(function(t){function e(n,i,o){let s={kind:"delete",uri:n};return i!==void 0&&(i.recursive!==void 0||i.ignoreIfNotExists!==void 0)&&(s.options=i),o!==void 0&&(s.annotationId=o),s}t.create=e;function r(n){let i=n;return i&&i.kind==="delete"&&b.string(i.uri)&&(i.options===void 0||(i.options.recursive===void 0||b.boolean(i.options.recursive))&&(i.options.ignoreIfNotExists===void 0||b.boolean(i.options.ignoreIfNotExists)))&&(i.annotationId===void 0||Va.is(i.annotationId))}t.is=r})(yy||(yy={}));var _y;(function(t){function e(r){let n=r;return n&&(n.changes!==void 0||n.documentChanges!==void 0)&&(n.documentChanges===void 0||n.documentChanges.every(i=>b.string(i.kind)?gy.is(i)||Ty.is(i)||yy.is(i):hy.is(i)))}t.is=e})(_y||(_y={}));var qS;(function(t){function e(n){return{uri:n}}t.create=e;function r(n){let i=n;return b.defined(i)&&b.string(i.uri)}t.is=r})(qS||(qS={}));var HS;(function(t){function e(n,i){return{uri:n,version:i}}t.create=e;function r(n){let i=n;return b.defined(i)&&b.string(i.uri)&&b.integer(i.version)}t.is=r})(HS||(HS={}));var vy;(function(t){function e(n,i){return{uri:n,version:i}}t.create=e;function r(n){let i=n;return b.defined(i)&&b.string(i.uri)&&(i.version===null||b.integer(i.version))}t.is=r})(vy||(vy={}));var KS;(function(t){function e(n,i,o,s){return{uri:n,languageId:i,version:o,text:s}}t.create=e;function r(n){let i=n;return b.defined(i)&&b.string(i.uri)&&b.string(i.languageId)&&b.integer(i.version)&&b.string(i.text)}t.is=r})(KS||(KS={}));var Ry;(function(t){t.PlainText="plaintext",t.Markdown="markdown";function e(r){let n=r;return n===t.PlainText||n===t.Markdown}t.is=e})(Ry||(Ry={}));var su;(function(t){function e(r){let n=r;return b.objectLiteral(r)&&Ry.is(n.kind)&&b.string(n.value)}t.is=e})(su||(su={}));var zS;(function(t){t.Text=1,t.Method=2,t.Function=3,t.Constructor=4,t.Field=5,t.Variable=6,t.Class=7,t.Interface=8,t.Module=9,t.Property=10,t.Unit=11,t.Value=12,t.Enum=13,t.Keyword=14,t.Snippet=15,t.Color=16,t.File=17,t.Reference=18,t.Folder=19,t.EnumMember=20,t.Constant=21,t.Struct=22,t.Event=23,t.Operator=24,t.TypeParameter=25})(zS||(zS={}));var YS;(function(t){t.PlainText=1,t.Snippet=2})(YS||(YS={}));var XS;(function(t){t.Deprecated=1})(XS||(XS={}));var JS;(function(t){function e(n,i,o){return{newText:n,insert:i,replace:o}}t.create=e;function r(n){let i=n;return i&&b.string(i.newText)&&Ae.is(i.insert)&&Ae.is(i.replace)}t.is=r})(JS||(JS={}));var QS;(function(t){t.asIs=1,t.adjustIndentation=2})(QS||(QS={}));var ZS;(function(t){function e(r){let n=r;return n&&(b.string(n.detail)||n.detail===void 0)&&(b.string(n.description)||n.description===void 0)}t.is=e})(ZS||(ZS={}));var eD;(function(t){function e(r){return{label:r}}t.create=e})(eD||(eD={}));var tD;(function(t){function e(r,n){return{items:r||[],isIncomplete:!!n}}t.create=e})(tD||(tD={}));var Hd;(function(t){function e(n){return n.replace(/[\\`*_{}[\]()#+\-.!]/g,"\\$&")}t.fromPlainText=e;function r(n){let i=n;return b.string(i)||b.objectLiteral(i)&&b.string(i.language)&&b.string(i.value)}t.is=r})(Hd||(Hd={}));var rD;(function(t){function e(r){let n=r;return!!n&&b.objectLiteral(n)&&(su.is(n.contents)||Hd.is(n.contents)||b.typedArray(n.contents,Hd.is))&&(r.range===void 0||Ae.is(r.range))}t.is=e})(rD||(rD={}));var nD;(function(t){function e(r,n){return n?{label:r,documentation:n}:{label:r}}t.create=e})(nD||(nD={}));var iD;(function(t){function e(r,n,...i){let o={label:r};return b.defined(n)&&(o.documentation=n),b.defined(i)?o.parameters=i:o.parameters=[],o}t.create=e})(iD||(iD={}));var oD;(function(t){t.Text=1,t.Read=2,t.Write=3})(oD||(oD={}));var sD;(function(t){function e(r,n){let i={range:r};return b.number(n)&&(i.kind=n),i}t.create=e})(sD||(sD={}));var aD;(function(t){t.File=1,t.Module=2,t.Namespace=3,t.Package=4,t.Class=5,t.Method=6,t.Property=7,t.Field=8,t.Constructor=9,t.Enum=10,t.Interface=11,t.Function=12,t.Variable=13,t.Constant=14,t.String=15,t.Number=16,t.Boolean=17,t.Array=18,t.Object=19,t.Key=20,t.Null=21,t.EnumMember=22,t.Struct=23,t.Event=24,t.Operator=25,t.TypeParameter=26})(aD||(aD={}));var lD;(function(t){t.Deprecated=1})(lD||(lD={}));var uD;(function(t){function e(r,n,i,o,s){let a={name:r,kind:n,location:{uri:o,range:i}};return s&&(a.containerName=s),a}t.create=e})(uD||(uD={}));var cD;(function(t){function e(r,n,i,o){return o!==void 0?{name:r,kind:n,location:{uri:i,range:o}}:{name:r,kind:n,location:{uri:i}}}t.create=e})(cD||(cD={}));var fD;(function(t){function e(n,i,o,s,a,l){let u={name:n,detail:i,kind:o,range:s,selectionRange:a};return l!==void 0&&(u.children=l),u}t.create=e;function r(n){let i=n;return i&&b.string(i.name)&&b.number(i.kind)&&Ae.is(i.range)&&Ae.is(i.selectionRange)&&(i.detail===void 0||b.string(i.detail))&&(i.deprecated===void 0||b.boolean(i.deprecated))&&(i.children===void 0||Array.isArray(i.children))&&(i.tags===void 0||Array.isArray(i.tags))}t.is=r})(fD||(fD={}));var dD;(function(t){t.Empty="",t.QuickFix="quickfix",t.Refactor="refactor",t.RefactorExtract="refactor.extract",t.RefactorInline="refactor.inline",t.RefactorRewrite="refactor.rewrite",t.Source="source",t.SourceOrganizeImports="source.organizeImports",t.SourceFixAll="source.fixAll"})(dD||(dD={}));var Kd;(function(t){t.Invoked=1,t.Automatic=2})(Kd||(Kd={}));var pD;(function(t){function e(n,i,o){let s={diagnostics:n};return i!=null&&(s.only=i),o!=null&&(s.triggerKind=o),s}t.create=e;function r(n){let i=n;return b.defined(i)&&b.typedArray(i.diagnostics,qd.is)&&(i.only===void 0||b.typedArray(i.only,b.string))&&(i.triggerKind===void 0||i.triggerKind===Kd.Invoked||i.triggerKind===Kd.Automatic)}t.is=r})(pD||(pD={}));var mD;(function(t){function e(n,i,o){let s={title:n},a=!0;return typeof i=="string"?(a=!1,s.kind=i):Ua.is(i)?s.command=i:s.edit=i,a&&o!==void 0&&(s.kind=o),s}t.create=e;function r(n){let i=n;return i&&b.string(i.title)&&(i.diagnostics===void 0||b.typedArray(i.diagnostics,qd.is))&&(i.kind===void 0||b.string(i.kind))&&(i.edit!==void 0||i.command!==void 0)&&(i.command===void 0||Ua.is(i.command))&&(i.isPreferred===void 0||b.boolean(i.isPreferred))&&(i.edit===void 0||_y.is(i.edit))}t.is=r})(mD||(mD={}));var hD;(function(t){function e(n,i){let o={range:n};return b.defined(i)&&(o.data=i),o}t.create=e;function r(n){let i=n;return b.defined(i)&&Ae.is(i.range)&&(b.undefined(i.command)||Ua.is(i.command))}t.is=r})(hD||(hD={}));var gD;(function(t){function e(n,i){return{tabSize:n,insertSpaces:i}}t.create=e;function r(n){let i=n;return b.defined(i)&&b.uinteger(i.tabSize)&&b.boolean(i.insertSpaces)}t.is=r})(gD||(gD={}));var TD;(function(t){function e(n,i,o){return{range:n,target:i,data:o}}t.create=e;function r(n){let i=n;return b.defined(i)&&Ae.is(i.range)&&(b.undefined(i.target)||b.string(i.target))}t.is=r})(TD||(TD={}));var yD;(function(t){function e(n,i){return{range:n,parent:i}}t.create=e;function r(n){let i=n;return b.objectLiteral(i)&&Ae.is(i.range)&&(i.parent===void 0||t.is(i.parent))}t.is=r})(yD||(yD={}));var _D;(function(t){t.namespace="namespace",t.type="type",t.class="class",t.enum="enum",t.interface="interface",t.struct="struct",t.typeParameter="typeParameter",t.parameter="parameter",t.variable="variable",t.property="property",t.enumMember="enumMember",t.event="event",t.function="function",t.method="method",t.macro="macro",t.keyword="keyword",t.modifier="modifier",t.comment="comment",t.string="string",t.number="number",t.regexp="regexp",t.operator="operator",t.decorator="decorator"})(_D||(_D={}));var vD;(function(t){t.declaration="declaration",t.definition="definition",t.readonly="readonly",t.static="static",t.deprecated="deprecated",t.abstract="abstract",t.async="async",t.modification="modification",t.documentation="documentation",t.defaultLibrary="defaultLibrary"})(vD||(vD={}));var RD;(function(t){function e(r){let n=r;return b.objectLiteral(n)&&(n.resultId===void 0||typeof n.resultId=="string")&&Array.isArray(n.data)&&(n.data.length===0||typeof n.data[0]=="number")}t.is=e})(RD||(RD={}));var xD;(function(t){function e(n,i){return{range:n,text:i}}t.create=e;function r(n){let i=n;return i!=null&&Ae.is(i.range)&&b.string(i.text)}t.is=r})(xD||(xD={}));var ND;(function(t){function e(n,i,o){return{range:n,variableName:i,caseSensitiveLookup:o}}t.create=e;function r(n){let i=n;return i!=null&&Ae.is(i.range)&&b.boolean(i.caseSensitiveLookup)&&(b.string(i.variableName)||i.variableName===void 0)}t.is=r})(ND||(ND={}));var ED;(function(t){function e(n,i){return{range:n,expression:i}}t.create=e;function r(n){let i=n;return i!=null&&Ae.is(i.range)&&(b.string(i.expression)||i.expression===void 0)}t.is=r})(ED||(ED={}));var ID;(function(t){function e(n,i){return{frameId:n,stoppedLocation:i}}t.create=e;function r(n){let i=n;return b.defined(i)&&Ae.is(n.stoppedLocation)}t.is=r})(ID||(ID={}));var xy;(function(t){t.Type=1,t.Parameter=2;function e(r){return r===1||r===2}t.is=e})(xy||(xy={}));var Ny;(function(t){function e(n){return{value:n}}t.create=e;function r(n){let i=n;return b.objectLiteral(i)&&(i.tooltip===void 0||b.string(i.tooltip)||su.is(i.tooltip))&&(i.location===void 0||jd.is(i.location))&&(i.command===void 0||Ua.is(i.command))}t.is=r})(Ny||(Ny={}));var OD;(function(t){function e(n,i,o){let s={position:n,label:i};return o!==void 0&&(s.kind=o),s}t.create=e;function r(n){let i=n;return b.objectLiteral(i)&&ke.is(i.position)&&(b.string(i.label)||b.typedArray(i.label,Ny.is))&&(i.kind===void 0||xy.is(i.kind))&&i.textEdits===void 0||b.typedArray(i.textEdits,uo.is)&&(i.tooltip===void 0||b.string(i.tooltip)||su.is(i.tooltip))&&(i.paddingLeft===void 0||b.boolean(i.paddingLeft))&&(i.paddingRight===void 0||b.boolean(i.paddingRight))}t.is=r})(OD||(OD={}));var AD;(function(t){function e(r){return{kind:"snippet",value:r}}t.createSnippet=e})(AD||(AD={}));var SD;(function(t){function e(r,n,i,o){return{insertText:r,filterText:n,range:i,command:o}}t.create=e})(SD||(SD={}));var DD;(function(t){function e(r){return{items:r}}t.create=e})(DD||(DD={}));var CD;(function(t){t.Invoked=0,t.Automatic=1})(CD||(CD={}));var bD;(function(t){function e(r,n){return{range:r,text:n}}t.create=e})(bD||(bD={}));var LD;(function(t){function e(r,n){return{triggerKind:r,selectedCompletionInfo:n}}t.create=e})(LD||(LD={}));var kD;(function(t){function e(r){let n=r;return b.objectLiteral(n)&&fy.is(n.uri)&&b.string(n.name)}t.is=e})(kD||(kD={}));var wD;(function(t){function e(o,s,a,l){return new Ey(o,s,a,l)}t.create=e;function r(o){let s=o;return!!(b.defined(s)&&b.string(s.uri)&&(b.undefined(s.languageId)||b.string(s.languageId))&&b.uinteger(s.lineCount)&&b.func(s.getText)&&b.func(s.positionAt)&&b.func(s.offsetAt))}t.is=r;function n(o,s){let a=o.getText(),l=i(s,(c,f)=>{let d=c.range.start.line-f.range.start.line;return d===0?c.range.start.character-f.range.start.character:d}),u=a.length;for(let c=l.length-1;c>=0;c--){let f=l[c],d=o.offsetAt(f.range.start),m=o.offsetAt(f.range.end);if(m<=u)a=a.substring(0,d)+f.newText+a.substring(m,a.length);else throw new Error("Overlapping edit");u=d}return a}t.applyEdits=n;function i(o,s){if(o.length<=1)return o;let a=o.length/2|0,l=o.slice(0,a),u=o.slice(a);i(l,s),i(u,s);let c=0,f=0,d=0;for(;c<l.length&&f<u.length;)s(l[c],u[f])<=0?o[d++]=l[c++]:o[d++]=u[f++];for(;c<l.length;)o[d++]=l[c++];for(;f<u.length;)o[d++]=u[f++];return o}})(wD||(wD={}));var Ey=class{constructor(e,r,n,i){this._uri=e,this._languageId=r,this._version=n,this._content=i,this._lineOffsets=void 0}get uri(){return this._uri}get languageId(){return this._languageId}get version(){return this._version}getText(e){if(e){let r=this.offsetAt(e.start),n=this.offsetAt(e.end);return this._content.substring(r,n)}return this._content}update(e,r){this._content=e.text,this._version=r,this._lineOffsets=void 0}getLineOffsets(){if(this._lineOffsets===void 0){let e=[],r=this._content,n=!0;for(let i=0;i<r.length;i++){n&&(e.push(i),n=!1);let o=r.charAt(i);n=o==="\r"||o===`
`,o==="\r"&&i+1<r.length&&r.charAt(i+1)===`
`&&i++}n&&r.length>0&&e.push(r.length),this._lineOffsets=e}return this._lineOffsets}positionAt(e){e=Math.max(Math.min(e,this._content.length),0);let r=this.getLineOffsets(),n=0,i=r.length;if(i===0)return ke.create(0,e);for(;n<i;){let s=Math.floor((n+i)/2);r[s]>e?i=s:n=s+1}let o=n-1;return ke.create(o,e-r[o])}offsetAt(e){let r=this.getLineOffsets();if(e.line>=r.length)return this._content.length;if(e.line<0)return 0;let n=r[e.line],i=e.line+1<r.length?r[e.line+1]:this._content.length;return Math.max(Math.min(n+e.character,i),n)}get lineCount(){return this.getLineOffsets().length}},b;(function(t){let e=Object.prototype.toString;function r(m){return typeof m!="undefined"}t.defined=r;function n(m){return typeof m=="undefined"}t.undefined=n;function i(m){return m===!0||m===!1}t.boolean=i;function o(m){return e.call(m)==="[object String]"}t.string=o;function s(m){return e.call(m)==="[object Number]"}t.number=s;function a(m,_,x){return e.call(m)==="[object Number]"&&_<=m&&m<=x}t.numberRange=a;function l(m){return e.call(m)==="[object Number]"&&-2147483648<=m&&m<=2147483647}t.integer=l;function u(m){return e.call(m)==="[object Number]"&&0<=m&&m<=2147483647}t.uinteger=u;function c(m){return e.call(m)==="[object Function]"}t.func=c;function f(m){return m!==null&&typeof m=="object"}t.objectLiteral=f;function d(m,_){return Array.isArray(m)&&m.every(_)}t.typedArray=d})(b||(b={}));var au=class{constructor(){this.nodeStack=[]}get current(){return this.nodeStack[this.nodeStack.length-1]}buildRootNode(e){return this.rootNode=new Ba(e),this.rootNode.root=this.rootNode,this.nodeStack=[this.rootNode],this.rootNode}buildCompositeNode(e){let r=new zo;return r.grammarSource=e,r.root=this.rootNode,this.current.content.push(r),this.nodeStack.push(r),r}buildLeafNode(e,r){let n=new Ko(e.startOffset,e.image.length,Gs(e),e.tokenType,!1);return n.grammarSource=r,n.root=this.rootNode,this.current.content.push(n),n}removeNode(e){let r=e.container;if(r){let n=r.content.indexOf(e);n>=0&&r.content.splice(n,1)}}construct(e){let r=this.current;typeof e.$type=="string"&&(this.current.astNode=e),e.$cstNode=r;let n=this.nodeStack.pop();(n==null?void 0:n.content.length)===0&&this.removeNode(n)}addHiddenTokens(e){for(let r of e){let n=new Ko(r.startOffset,r.image.length,Gs(r),r.tokenType,!0);n.root=this.rootNode,this.addHiddenToken(this.rootNode,n)}}addHiddenToken(e,r){let{offset:n,end:i}=r;for(let o=0;o<e.content.length;o++){let s=e.content[o],{offset:a,end:l}=s;if(Ar(s)&&n>a&&i<l){this.addHiddenToken(s,r);return}else if(i<=a){e.content.splice(o,0,r);return}}e.content.push(r)}},lu=class{get parent(){return this.container}get feature(){return this.grammarSource}get hidden(){return!1}get astNode(){var e,r;let n=typeof((e=this._astNode)===null||e===void 0?void 0:e.$type)=="string"?this._astNode:(r=this.container)===null||r===void 0?void 0:r.astNode;if(!n)throw new Error("This node has no associated AST element");return n}set astNode(e){this._astNode=e}get element(){return this.astNode}get text(){return this.root.fullText.substring(this.offset,this.end)}},Ko=class extends lu{get offset(){return this._offset}get length(){return this._length}get end(){return this._offset+this._length}get hidden(){return this._hidden}get tokenType(){return this._tokenType}get range(){return this._range}constructor(e,r,n,i,o=!1){super(),this._hidden=o,this._offset=e,this._tokenType=i,this._length=r,this._range=n}},zo=class extends lu{constructor(){super(...arguments),this.content=new Iy(this)}get children(){return this.content}get offset(){var e,r;return(r=(e=this.firstNonHiddenNode)===null||e===void 0?void 0:e.offset)!==null&&r!==void 0?r:0}get length(){return this.end-this.offset}get end(){var e,r;return(r=(e=this.lastNonHiddenNode)===null||e===void 0?void 0:e.end)!==null&&r!==void 0?r:0}get range(){let e=this.firstNonHiddenNode,r=this.lastNonHiddenNode;if(e&&r){if(this._rangeCache===void 0){let{range:n}=e,{range:i}=r;this._rangeCache={start:n.start,end:i.end.line<n.start.line?n.start:i.end}}return this._rangeCache}else return{start:ke.create(0,0),end:ke.create(0,0)}}get firstNonHiddenNode(){for(let e of this.content)if(!e.hidden)return e;return this.content[0]}get lastNonHiddenNode(){for(let e=this.content.length-1;e>=0;e--){let r=this.content[e];if(!r.hidden)return r}return this.content[this.content.length-1]}},Iy=class t extends Array{constructor(e){super(),this.parent=e,Object.setPrototypeOf(this,t.prototype)}push(...e){return this.addParents(e),super.push(...e)}unshift(...e){return this.addParents(e),super.unshift(...e)}splice(e,r,...n){return this.addParents(n),super.splice(e,r,...n)}addParents(e){for(let r of e)r.container=this.parent}},Ba=class extends zo{get text(){return this._text.substring(this.offset,this.end)}get fullText(){return this._text}constructor(e){super(),this._text="",this._text=e!=null?e:""}};var zd=Symbol("Datatype");function Oy(t){return t.$type===zd}var $D="\u200B",PD=t=>t.endsWith($D)?t:t+$D,uu=class{constructor(e){this._unorderedGroups=new Map,this.lexer=e.parser.Lexer;let r=this.lexer.definition;this.wrapper=new Ay(r,Object.assign(Object.assign({},e.parser.ParserConfig),{errorMessageProvider:e.parser.ParserErrorMessageProvider}))}alternatives(e,r){this.wrapper.wrapOr(e,r)}optional(e,r){this.wrapper.wrapOption(e,r)}many(e,r){this.wrapper.wrapMany(e,r)}atLeastOne(e,r){this.wrapper.wrapAtLeastOne(e,r)}isRecording(){return this.wrapper.IS_RECORDING}get unorderedGroups(){return this._unorderedGroups}getRuleStack(){return this.wrapper.RULE_STACK}finalize(){this.wrapper.wrapSelfAnalysis()}},cu=class extends uu{get current(){return this.stack[this.stack.length-1]}constructor(e){super(e),this.nodeBuilder=new au,this.stack=[],this.assignmentMap=new Map,this.linker=e.references.Linker,this.converter=e.parser.ValueConverter,this.astReflection=e.shared.AstReflection}rule(e,r){let n=e.fragment?void 0:kl(e)?zd:li(e),i=this.wrapper.DEFINE_RULE(PD(e.name),this.startImplementation(n,r).bind(this));return e.entry&&(this.mainRule=i),i}parse(e){this.nodeBuilder.buildRootNode(e);let r=this.lexer.tokenize(e);this.wrapper.input=r.tokens;let n=this.mainRule.call(this.wrapper,{});return this.nodeBuilder.addHiddenTokens(r.hidden),this.unorderedGroups.clear(),{value:n,lexerErrors:r.errors,parserErrors:this.wrapper.errors}}startImplementation(e,r){return n=>{if(!this.isRecording()){let o={$type:e};this.stack.push(o),e===zd&&(o.value="")}let i;try{i=r(n)}catch{i=void 0}return!this.isRecording()&&i===void 0&&(i=this.construct()),i}}consume(e,r,n){let i=this.wrapper.wrapConsume(e,r);if(!this.isRecording()&&this.isValidToken(i)){let o=this.nodeBuilder.buildLeafNode(i,n),{assignment:s,isCrossRef:a}=this.getAssignment(n),l=this.current;if(s){let u=ur(n)?i.image:this.converter.convert(i.image,o);this.assign(s.operator,s.feature,u,o,a)}else if(Oy(l)){let u=i.image;ur(n)||(u=this.converter.convert(u,o).toString()),l.value+=u}}}isValidToken(e){return!e.isInsertedInRecovery&&!isNaN(e.startOffset)&&typeof e.endOffset=="number"&&!isNaN(e.endOffset)}subrule(e,r,n,i){let o;this.isRecording()||(o=this.nodeBuilder.buildCompositeNode(n));let s=this.wrapper.wrapSubrule(e,r,i);!this.isRecording()&&o&&o.length>0&&this.performSubruleAssignment(s,n,o)}performSubruleAssignment(e,r,n){let{assignment:i,isCrossRef:o}=this.getAssignment(r);if(i)this.assign(i.operator,i.feature,e,n,o);else if(!i){let s=this.current;if(Oy(s))s.value+=e.toString();else if(typeof e=="object"&&e){let a=e.$type,l=this.assignWithoutOverride(e,s);a&&(l.$type=a);let u=l;this.stack.pop(),this.stack.push(u)}}}action(e,r){if(!this.isRecording()){let n=this.current;if(!n.$cstNode&&r.feature&&r.operator){n=this.construct(!1);let o=n.$cstNode.feature;this.nodeBuilder.buildCompositeNode(o)}let i={$type:e};this.stack.pop(),this.stack.push(i),r.feature&&r.operator&&this.assign(r.operator,r.feature,n,n.$cstNode,!1)}}construct(e=!0){if(this.isRecording())return;let r=this.current;return Rf(r),this.nodeBuilder.construct(r),e&&this.stack.pop(),Oy(r)?this.converter.convert(r.value,r.$cstNode):(Ol(this.astReflection,r),r)}getAssignment(e){if(!this.assignmentMap.has(e)){let r=tn(e,vr);this.assignmentMap.set(e,{assignment:r,isCrossRef:r?On(r.terminal):!1})}return this.assignmentMap.get(e)}assign(e,r,n,i,o){let s=this.current,a;switch(o&&typeof n=="string"?a=this.linker.buildReference(s,r,i,n):a=n,e){case"=":{s[r]=a;break}case"?=":{s[r]=!0;break}case"+=":Array.isArray(s[r])||(s[r]=[]),s[r].push(a)}}assignWithoutOverride(e,r){for(let[n,i]of Object.entries(r)){let o=e[n];o===void 0?e[n]=i:Array.isArray(o)&&Array.isArray(i)&&(i.push(...o),e[n]=i)}return e}get definitionErrors(){return this.wrapper.definitionErrors}},Yd=class{buildMismatchTokenMessage(e){return Ti.buildMismatchTokenMessage(e)}buildNotAllInputParsedMessage(e){return Ti.buildNotAllInputParsedMessage(e)}buildNoViableAltMessage(e){return Ti.buildNoViableAltMessage(e)}buildEarlyExitMessage(e){return Ti.buildEarlyExitMessage(e)}},Wa=class extends Yd{buildMismatchTokenMessage({expected:e,actual:r}){return`Expecting ${e.LABEL?"`"+e.LABEL+"`":e.name.endsWith(":KW")?`keyword '${e.name.substring(0,e.name.length-3)}'`:`token of type '${e.name}'`} but found \`${r.image}\`.`}buildNotAllInputParsedMessage({firstRedundant:e}){return`Expecting end of file but found \`${e.image}\`.`}},fu=class extends uu{constructor(){super(...arguments),this.tokens=[],this.elementStack=[],this.lastElementStack=[],this.nextTokenIndex=0,this.stackSize=0}action(){}construct(){}parse(e){this.resetState();let r=this.lexer.tokenize(e);return this.tokens=r.tokens,this.wrapper.input=[...this.tokens],this.mainRule.call(this.wrapper,{}),this.unorderedGroups.clear(),{tokens:this.tokens,elementStack:[...this.lastElementStack],tokenIndex:this.nextTokenIndex}}rule(e,r){let n=this.wrapper.DEFINE_RULE(PD(e.name),this.startImplementation(r).bind(this));return e.entry&&(this.mainRule=n),n}resetState(){this.elementStack=[],this.lastElementStack=[],this.nextTokenIndex=0,this.stackSize=0}startImplementation(e){return r=>{let n=this.keepStackSize();try{e(r)}finally{this.resetStackSize(n)}}}removeUnexpectedElements(){this.elementStack.splice(this.stackSize)}keepStackSize(){let e=this.elementStack.length;return this.stackSize=e,e}resetStackSize(e){this.removeUnexpectedElements(),this.stackSize=e}consume(e,r,n){this.wrapper.wrapConsume(e,r),this.isRecording()||(this.lastElementStack=[...this.elementStack,n],this.nextTokenIndex=this.currIdx+1)}subrule(e,r,n,i){this.before(n),this.wrapper.wrapSubrule(e,r,i),this.after(n)}before(e){this.isRecording()||this.elementStack.push(e)}after(e){if(!this.isRecording()){let r=this.elementStack.lastIndexOf(e);r>=0&&this.elementStack.splice(r)}}get currIdx(){return this.wrapper.currIdx}},iW={recoveryEnabled:!0,nodeLocationTracking:"full",skipValidations:!0,errorMessageProvider:new Wa},Ay=class extends tu{constructor(e,r){let n=r&&"maxLookahead"in r;super(e,Object.assign(Object.assign(Object.assign({},iW),{lookaheadStrategy:n?new yi({maxLookahead:r.maxLookahead}):new ou}),r))}get IS_RECORDING(){return this.RECORDING_PHASE}DEFINE_RULE(e,r){return this.RULE(e,r)}wrapSelfAnalysis(){this.performSelfAnalysis()}wrapConsume(e,r){return this.consume(e,r)}wrapSubrule(e,r,n){return this.subrule(e,r,{ARGS:[n]})}wrapOr(e,r){this.or(e,r)}wrapOption(e,r){this.option(e,r)}wrapMany(e,r){this.many(e,r)}wrapAtLeastOne(e,r){this.atLeastOne(e,r)}};function Jd(t,e,r){return oW({parser:e,tokens:r,rules:new Map,ruleNames:new Map},t),e}function oW(t,e){let r=bl(e,!1),n=pe(e.rules).filter(Ct).filter(i=>r.has(i));for(let i of n){let o=Object.assign(Object.assign({},t),{consume:1,optional:1,subrule:1,many:1,or:1});o.rules.set(i.name,t.parser.rule(i,Yo(o,i.definition)))}}function Yo(t,e,r=!1){let n;if(ur(e))n=dW(t,e);else if(In(e))n=sW(t,e);else if(vr(e))n=Yo(t,e.terminal);else if(On(e))n=MD(t,e);else if(Gr(e))n=aW(t,e);else if(Vs(e))n=uW(t,e);else if(Bs(e))n=cW(t,e);else if(fn(e))n=fW(t,e);else if(wg(e)){let i=t.consume++;n=()=>t.parser.consume(i,nn,e)}else throw new Co(e.$cstNode,`Unexpected element type: ${e.$type}`);return FD(t,r?void 0:Xd(e),n,e.cardinality)}function sW(t,e){let r=li(e);return()=>t.parser.action(r,e)}function aW(t,e){let r=e.rule.ref;if(Ct(r)){let n=t.subrule++,i=e.arguments.length>0?lW(r,e.arguments):()=>({});return o=>t.parser.subrule(n,UD(t,r),e,i(o))}else if(Wr(r)){let n=t.consume++,i=Sy(t,r.name);return()=>t.parser.consume(n,i,e)}else if(r)Gi(r);else throw new Co(e.$cstNode,`Undefined rule type: ${e.$type}`)}function lW(t,e){let r=e.map(n=>_i(n.value));return n=>{let i={};for(let o=0;o<r.length;o++){let s=t.parameters[o],a=r[o];i[s.name]=a(n)}return i}}function _i(t){if(lg(t)){let e=_i(t.left),r=_i(t.right);return n=>e(n)||r(n)}else if(sg(t)){let e=_i(t.left),r=_i(t.right);return n=>e(n)&&r(n)}else if(pg(t)){let e=_i(t.value);return r=>!e(r)}else if(Tg(t)){let e=t.parameter.ref.name;return r=>r!==void 0&&r[e]===!0}else if(ig(t)){let e=!!t.true;return()=>e}Gi(t)}function uW(t,e){if(e.elements.length===1)return Yo(t,e.elements[0]);{let r=[];for(let i of e.elements){let o={ALT:Yo(t,i,!0)},s=Xd(i);s&&(o.GATE=_i(s)),r.push(o)}let n=t.or++;return i=>t.parser.alternatives(n,r.map(o=>{let s={ALT:()=>o.ALT(i)},a=o.GATE;return a&&(s.GATE=()=>a(i)),s}))}}function cW(t,e){if(e.elements.length===1)return Yo(t,e.elements[0]);let r=[];for(let a of e.elements){let l={ALT:Yo(t,a,!0)},u=Xd(a);u&&(l.GATE=_i(u)),r.push(l)}let n=t.or++,i=(a,l)=>{let u=l.getRuleStack().join("-");return`uGroup_${a}_${u}`},o=a=>t.parser.alternatives(n,r.map((l,u)=>{let c={ALT:()=>!0},f=t.parser;c.ALT=()=>{if(l.ALT(a),!f.isRecording()){let m=i(n,f);f.unorderedGroups.get(m)||f.unorderedGroups.set(m,[]);let _=f.unorderedGroups.get(m);typeof(_==null?void 0:_[u])=="undefined"&&(_[u]=!0)}};let d=l.GATE;return d?c.GATE=()=>d(a):c.GATE=()=>{let m=f.unorderedGroups.get(i(n,f));return!(m!=null&&m[u])},c})),s=FD(t,Xd(e),o,"*");return a=>{s(a),t.parser.isRecording()||t.parser.unorderedGroups.delete(i(n,t.parser))}}function fW(t,e){let r=e.elements.map(n=>Yo(t,n));return n=>r.forEach(i=>i(n))}function Xd(t){if(fn(t))return t.guardCondition}function MD(t,e,r=e.terminal){if(r)if(Gr(r)&&Ct(r.rule.ref)){let n=t.subrule++;return i=>t.parser.subrule(n,UD(t,r.rule.ref),e,i)}else if(Gr(r)&&Wr(r.rule.ref)){let n=t.consume++,i=Sy(t,r.rule.ref.name);return()=>t.parser.consume(n,i,e)}else if(ur(r)){let n=t.consume++,i=Sy(t,r.value);return()=>t.parser.consume(n,i,e)}else throw new Error("Could not build cross reference parser");else{if(!e.type.ref)throw new Error("Could not resolve reference to type: "+e.type.$refText);let n=Af(e.type.ref),i=n==null?void 0:n.terminal;if(!i)throw new Error("Could not find name assignment for type: "+li(e.type.ref));return MD(t,e,i)}}function dW(t,e){let r=t.consume++,n=t.tokens[e.value];if(!n)throw new Error("Could not find token for keyword: "+e.value);return()=>t.parser.consume(r,n,e)}function FD(t,e,r,n){let i=e&&_i(e);if(!n)if(i){let o=t.or++;return s=>t.parser.alternatives(o,[{ALT:()=>r(s),GATE:()=>i(s)},{ALT:Vd(),GATE:()=>!i(s)}])}else return r;if(n==="*"){let o=t.many++;return s=>t.parser.many(o,{DEF:()=>r(s),GATE:i?()=>i(s):void 0})}else if(n==="+"){let o=t.many++;if(i){let s=t.or++;return a=>t.parser.alternatives(s,[{ALT:()=>t.parser.atLeastOne(o,{DEF:()=>r(a)}),GATE:()=>i(a)},{ALT:Vd(),GATE:()=>!i(a)}])}else return s=>t.parser.atLeastOne(o,{DEF:()=>r(s)})}else if(n==="?"){let o=t.optional++;return s=>t.parser.optional(o,{DEF:()=>r(s),GATE:i?()=>i(s):void 0})}else Gi(n)}function UD(t,e){let r=pW(t,e),n=t.rules.get(r);if(!n)throw new Error(`Rule "${r}" not found."`);return n}function pW(t,e){if(Ct(e))return e.name;if(t.ruleNames.has(e))return t.ruleNames.get(e);{let r=e,n=r.$container,i=e.$type;for(;!Ct(n);)(fn(n)||Vs(n)||Bs(n))&&(i=n.elements.indexOf(r).toString()+":"+i),r=n,n=n.$container;return i=n.name+":"+i,t.ruleNames.set(e,i),i}}function Sy(t,e){let r=t.tokens[e];if(!r)throw new Error(`Token "${e}" not found."`);return r}function Dy(t){let e=t.Grammar,r=t.parser.Lexer,n=new fu(t);return Jd(e,n,r.definition),n.finalize(),n}function Cy(t){let e=VD(t);return e.finalize(),e}function VD(t){let e=t.Grammar,r=t.parser.Lexer,n=new cu(t);return Jd(e,n,r.definition)}var du=class{buildTokens(e,r){let n=pe(bl(e,!1)),i=this.buildTerminalTokens(n),o=this.buildKeywordTokens(n,i,r);return i.forEach(s=>{let a=s.PATTERN;typeof a=="object"&&a&&"test"in a&&Ef(a)?o.unshift(s):o.push(s)}),o}buildTerminalTokens(e){return e.filter(Wr).filter(r=>!r.fragment).map(r=>this.buildTerminalToken(r)).toArray()}buildTerminalToken(e){let r=qi(e),n=this.requiresCustomPattern(r)?this.regexPatternFunction(r):r,i={name:e.name,PATTERN:n,LINE_BREAKS:!0};return e.hidden&&(i.GROUP=Ef(r)?kt.SKIPPED:"hidden"),i}requiresCustomPattern(e){return e.flags.includes("u")?!0:!!(e.source.includes("?<=")||e.source.includes("?<!"))}regexPatternFunction(e){let r=new RegExp(e,e.flags+"y");return(n,i)=>(r.lastIndex=i,r.exec(n))}buildKeywordTokens(e,r,n){return e.filter(Ct).flatMap(i=>jr(i).filter(ur)).distinct(i=>i.value).toArray().sort((i,o)=>o.value.length-i.value.length).map(i=>this.buildKeywordToken(i,r,!!(n!=null&&n.caseInsensitive)))}buildKeywordToken(e,r,n){return{name:e.value,PATTERN:this.buildKeywordPattern(e,n),LONGER_ALT:this.findLongerAlt(e,r)}}buildKeywordPattern(e,r){return r?new RegExp(fT(e.value)):e.value}findLongerAlt(e,r){return r.reduce((n,i)=>{let o=i==null?void 0:i.PATTERN;return o!=null&&o.source&&dT("^"+o.source+"$",e.value)&&n.push(i),n},[])}};var pu=class{convert(e,r){let n=r.grammarSource;if(On(n)&&(n=Ll(n)),Gr(n)){let i=n.rule.ref;if(!i)throw new Error("This cst node was not parsed by a rule.");return this.runConverter(i,e,r)}return e}runConverter(e,r,n){var i;switch(e.name.toUpperCase()){case"INT":return Jn.convertInt(r);case"STRING":return Jn.convertString(r);case"ID":return Jn.convertID(r)}switch((i=vT(e))===null||i===void 0?void 0:i.toLowerCase()){case"number":return Jn.convertNumber(r);case"boolean":return Jn.convertBoolean(r);case"bigint":return Jn.convertBigint(r);case"date":return Jn.convertDate(r);default:return r}}},Jn;(function(t){function e(u){let c="";for(let f=1;f<u.length-1;f++){let d=u.charAt(f);if(d==="\\"){let m=u.charAt(++f);c+=r(m)}else c+=d}return c}t.convertString=e;function r(u){switch(u){case"b":return"\b";case"f":return"\f";case"n":return`
`;case"r":return"\r";case"t":return"	";case"v":return"\v";case"0":return"\0";default:return u}}function n(u){return u.charAt(0)==="^"?u.substring(1):u}t.convertID=n;function i(u){return parseInt(u)}t.convertInt=i;function o(u){return BigInt(u)}t.convertBigint=o;function s(u){return new Date(u)}t.convertDate=s;function a(u){return Number(u)}t.convertNumber=a;function l(u){return u.toLowerCase()==="true"}t.convertBoolean=l})(Jn||(Jn={}));var re={};De(re,yt(qD(),1));function Vy(){return new Promise(t=>{typeof setImmediate=="undefined"?setTimeout(t,0):setImmediate(t)})}var Uy=0,HD=10;function KD(){return Uy=Date.now(),new re.CancellationTokenSource}function zD(t){HD=t}var Qn=Symbol("OperationCancelled");function Zn(t){return t===Qn}async function Ot(t){if(t===re.CancellationToken.None)return;let e=Date.now();if(e-Uy>=HD&&(Uy=e,await Vy()),t.isCancellationRequested)throw Qn}var wr=class{constructor(){this.promise=new Promise((e,r)=>{this.resolve=n=>(e(n),this),this.reject=n=>(r(n),this)})}};var tp=class t{constructor(e,r,n,i){this._uri=e,this._languageId=r,this._version=n,this._content=i,this._lineOffsets=void 0}get uri(){return this._uri}get languageId(){return this._languageId}get version(){return this._version}getText(e){if(e){let r=this.offsetAt(e.start),n=this.offsetAt(e.end);return this._content.substring(r,n)}return this._content}update(e,r){for(let n of e)if(t.isIncremental(n)){let i=XD(n.range),o=this.offsetAt(i.start),s=this.offsetAt(i.end);this._content=this._content.substring(0,o)+n.text+this._content.substring(s,this._content.length);let a=Math.max(i.start.line,0),l=Math.max(i.end.line,0),u=this._lineOffsets,c=YD(n.text,!1,o);if(l-a===c.length)for(let d=0,m=c.length;d<m;d++)u[d+a+1]=c[d];else c.length<1e4?u.splice(a+1,l-a,...c):this._lineOffsets=u=u.slice(0,a+1).concat(c,u.slice(l+1));let f=n.text.length-(s-o);if(f!==0)for(let d=a+1+c.length,m=u.length;d<m;d++)u[d]=u[d]+f}else if(t.isFull(n))this._content=n.text,this._lineOffsets=void 0;else throw new Error("Unknown change event received");this._version=r}getLineOffsets(){return this._lineOffsets===void 0&&(this._lineOffsets=YD(this._content,!0)),this._lineOffsets}positionAt(e){e=Math.max(Math.min(e,this._content.length),0);let r=this.getLineOffsets(),n=0,i=r.length;if(i===0)return{line:0,character:e};for(;n<i;){let s=Math.floor((n+i)/2);r[s]>e?i=s:n=s+1}let o=n-1;return{line:o,character:e-r[o]}}offsetAt(e){let r=this.getLineOffsets();if(e.line>=r.length)return this._content.length;if(e.line<0)return 0;let n=r[e.line],i=e.line+1<r.length?r[e.line+1]:this._content.length;return Math.max(Math.min(n+e.character,i),n)}get lineCount(){return this.getLineOffsets().length}static isIncremental(e){let r=e;return r!=null&&typeof r.text=="string"&&r.range!==void 0&&(r.rangeLength===void 0||typeof r.rangeLength=="number")}static isFull(e){let r=e;return r!=null&&typeof r.text=="string"&&r.range===void 0&&r.rangeLength===void 0}},co;(function(t){function e(i,o,s,a){return new tp(i,o,s,a)}t.create=e;function r(i,o,s){if(i instanceof tp)return i.update(o,s),i;throw new Error("TextDocument.update: document must be created by TextDocument.create")}t.update=r;function n(i,o){let s=i.getText(),a=By(o.map(NW),(c,f)=>{let d=c.range.start.line-f.range.start.line;return d===0?c.range.start.character-f.range.start.character:d}),l=0,u=[];for(let c of a){let f=i.offsetAt(c.range.start);if(f<l)throw new Error("Overlapping edit");f>l&&u.push(s.substring(l,f)),c.newText.length&&u.push(c.newText),l=i.offsetAt(c.range.end)}return u.push(s.substr(l)),u.join("")}t.applyEdits=n})(co||(co={}));function By(t,e){if(t.length<=1)return t;let r=t.length/2|0,n=t.slice(0,r),i=t.slice(r);By(n,e),By(i,e);let o=0,s=0,a=0;for(;o<n.length&&s<i.length;)e(n[o],i[s])<=0?t[a++]=n[o++]:t[a++]=i[s++];for(;o<n.length;)t[a++]=n[o++];for(;s<i.length;)t[a++]=i[s++];return t}function YD(t,e,r=0){let n=e?[r]:[];for(let i=0;i<t.length;i++){let o=t.charCodeAt(i);(o===13||o===10)&&(o===13&&i+1<t.length&&t.charCodeAt(i+1)===10&&i++,n.push(r+i+1))}return n}function XD(t){let e=t.start,r=t.end;return e.line>r.line||e.line===r.line&&e.character>r.character?{start:r,end:e}:t}function NW(t){let e=XD(t.range);return e!==t.range?{newText:t.newText,range:e}:t}var ae;(function(t){t[t.Changed=0]="Changed",t[t.Parsed=1]="Parsed",t[t.IndexedContent=2]="IndexedContent",t[t.ComputedScopes=3]="ComputedScopes",t[t.Linked=4]="Linked",t[t.IndexedReferences=5]="IndexedReferences",t[t.Validated=6]="Validated"})(ae||(ae={}));var mu=class{constructor(e){this.serviceRegistry=e.ServiceRegistry,this.textDocuments=e.workspace.TextDocuments,this.fileSystemProvider=e.workspace.FileSystemProvider}async fromUri(e,r=re.CancellationToken.None){let n=await this.fileSystemProvider.readFile(e);return this.createAsync(e,n,r)}fromTextDocument(e,r,n){return r=r!=null?r:Pe.parse(e.uri),n?this.createAsync(r,e,n):this.create(r,e)}fromString(e,r,n){return n?this.createAsync(r,e,n):this.create(r,e)}fromModel(e,r){return this.create(r,{$model:e})}create(e,r){if(typeof r=="string"){let n=this.parse(e,r);return this.createLangiumDocument(n,e,void 0,r)}else if("$model"in r){let n={value:r.$model,parserErrors:[],lexerErrors:[]};return this.createLangiumDocument(n,e)}else{let n=this.parse(e,r.getText());return this.createLangiumDocument(n,e,r)}}async createAsync(e,r,n){if(typeof r=="string"){let i=await this.parseAsync(e,r,n);return this.createLangiumDocument(i,e,void 0,r)}else{let i=await this.parseAsync(e,r.getText(),n);return this.createLangiumDocument(i,e,r)}}createLangiumDocument(e,r,n,i){let o;if(n)o={parseResult:e,uri:r,state:ae.Parsed,references:[],textDocument:n};else{let s=this.createTextDocumentGetter(r,i);o={parseResult:e,uri:r,state:ae.Parsed,references:[],get textDocument(){return s()}}}return e.value.$document=o,o}async update(e,r){var n,i;let o=(n=e.parseResult.value.$cstNode)===null||n===void 0?void 0:n.root.fullText,s=(i=this.textDocuments)===null||i===void 0?void 0:i.get(e.uri.toString()),a=s?s.getText():await this.fileSystemProvider.readFile(e.uri);if(s)Object.defineProperty(e,"textDocument",{value:s});else{let l=this.createTextDocumentGetter(e.uri,a);Object.defineProperty(e,"textDocument",{get:l})}return o!==a&&(e.parseResult=await this.parseAsync(e.uri,a,r),e.parseResult.value.$document=e),e.state=ae.Parsed,e}parse(e,r){return this.serviceRegistry.getServices(e).parser.LangiumParser.parse(r)}parseAsync(e,r,n){return this.serviceRegistry.getServices(e).parser.AsyncParser.parse(r,n)}createTextDocumentGetter(e,r){let n=this.serviceRegistry,i;return()=>i!=null?i:i=co.create(e.toString(),n.getServices(e).LanguageMetaData.languageId,0,r!=null?r:"")}},hu=class{constructor(e){this.documentMap=new Map,this.langiumDocumentFactory=e.workspace.LangiumDocumentFactory}get all(){return pe(this.documentMap.values())}addDocument(e){let r=e.uri.toString();if(this.documentMap.has(r))throw new Error(`A document with the URI '${r}' is already present.`);this.documentMap.set(r,e)}getDocument(e){let r=e.toString();return this.documentMap.get(r)}async getOrCreateDocument(e,r){let n=this.getDocument(e);return n||(n=await this.langiumDocumentFactory.fromUri(e,r),this.addDocument(n),n)}createDocument(e,r,n){if(n)return this.langiumDocumentFactory.fromString(r,e,n).then(i=>(this.addDocument(i),i));{let i=this.langiumDocumentFactory.fromString(r,e);return this.addDocument(i),i}}hasDocument(e){return this.documentMap.has(e.toString())}invalidateDocument(e){let r=e.toString(),n=this.documentMap.get(r);return n&&(n.state=ae.Changed,n.precomputedScopes=void 0,n.references=[],n.diagnostics=void 0),n}deleteDocument(e){let r=e.toString(),n=this.documentMap.get(r);return n&&(n.state=ae.Changed,this.documentMap.delete(r)),n}};var Xo=class{constructor(e){this.reflection=e.shared.AstReflection,this.langiumDocuments=()=>e.shared.workspace.LangiumDocuments,this.scopeProvider=e.references.ScopeProvider,this.astNodeLocator=e.workspace.AstNodeLocator}async link(e,r=re.CancellationToken.None){for(let n of qr(e.parseResult.value))await Ot(r),js(n).forEach(i=>this.doLink(i,e))}doLink(e,r){let n=e.reference;if(n._ref===void 0)try{let i=this.getCandidate(e);if(Nn(i))n._ref=i;else if(n._nodeDescription=i,this.langiumDocuments().hasDocument(i.documentUri)){let o=this.loadAstNode(i);n._ref=o!=null?o:this.createLinkingError(e,i)}}catch(i){n._ref=Object.assign(Object.assign({},e),{message:`An error occurred while resolving reference to '${n.$refText}': ${i}`})}r.references.push(n)}unlink(e){for(let r of e.references)delete r._ref,delete r._nodeDescription;e.references=[]}getCandidate(e){let n=this.scopeProvider.getScope(e).getElement(e.reference.$refText);return n!=null?n:this.createLinkingError(e)}buildReference(e,r,n,i){let o=this,s={$refNode:n,$refText:i,get ref(){var a;if(Be(this._ref))return this._ref;if(_l(this._nodeDescription)){let l=o.loadAstNode(this._nodeDescription);this._ref=l!=null?l:o.createLinkingError({reference:s,container:e,property:r},this._nodeDescription)}else if(this._ref===void 0){let l=o.getLinkedNode({reference:s,container:e,property:r});if(l.error&&xt(e).state<ae.ComputedScopes)return;this._ref=(a=l.node)!==null&&a!==void 0?a:l.error,this._nodeDescription=l.descr}return Be(this._ref)?this._ref:void 0},get $nodeDescription(){return this._nodeDescription},get error(){return Nn(this._ref)?this._ref:void 0}};return s}getLinkedNode(e){try{let r=this.getCandidate(e);if(Nn(r))return{error:r};let n=this.loadAstNode(r);return n?{node:n,descr:r}:{descr:r,error:this.createLinkingError(e,r)}}catch(r){return{error:Object.assign(Object.assign({},e),{message:`An error occurred while resolving reference to '${e.reference.$refText}': ${r}`})}}}loadAstNode(e){if(e.node)return e.node;let r=this.langiumDocuments().getDocument(e.documentUri);if(r)return this.astNodeLocator.getAstNode(r.parseResult.value,e.path)}createLinkingError(e,r){let n=xt(e.container);n.state<ae.ComputedScopes&&console.warn(`Attempted reference resolution before document reached ComputedScopes state (${n.uri}).`);let i=this.reflection.getReferenceType(e);return Object.assign(Object.assign({},e),{message:`Could not resolve reference to ${i} named '${e.reference.$refText}'.`,targetDescription:r})}};function rp(t){return typeof t.name=="string"}var Jo=class{getName(e){if(rp(e))return e.name}getNameNode(e){return ji(e.$cstNode,"name")}};var Qo=class{constructor(e){this.nameProvider=e.references.NameProvider,this.index=e.shared.workspace.IndexManager,this.nodeLocator=e.workspace.AstNodeLocator}findDeclaration(e){if(e){let r=yT(e),n=e.astNode;if(r&&n){let i=n[r.feature];if(Rt(i))return i.ref;if(Array.isArray(i)){for(let o of i)if(Rt(o)&&o.$refNode&&o.$refNode.offset<=e.offset&&o.$refNode.end>=e.end)return o.ref}}if(n){let i=this.nameProvider.getNameNode(n);if(i&&(i===e||eT(e,i)))return n}}}findDeclarationNode(e){let r=this.findDeclaration(e);if(r!=null&&r.$cstNode){let n=this.nameProvider.getNameNode(r);return n!=null?n:r.$cstNode}}findReferences(e,r){let n=[];if(r.includeDeclaration){let o=this.getReferenceToSelf(e);o&&n.push(o)}let i=this.index.findAllReferences(e,this.nodeLocator.getAstNodePath(e));return r.documentUri&&(i=i.filter(o=>Vt.equals(o.sourceUri,r.documentUri))),n.push(...i),pe(n)}getReferenceToSelf(e){let r=this.nameProvider.getNameNode(e);if(r){let n=xt(e),i=this.nodeLocator.getAstNodePath(e);return{sourceUri:n.uri,sourcePath:i,targetUri:n.uri,targetPath:i,segment:So(r),local:!0}}}};var hn=class{constructor(e){if(this.map=new Map,e)for(let[r,n]of e)this.add(r,n)}get size(){return Ws.sum(pe(this.map.values()).map(e=>e.length))}clear(){this.map.clear()}delete(e,r){if(r===void 0)return this.map.delete(e);{let n=this.map.get(e);if(n){let i=n.indexOf(r);if(i>=0)return n.length===1?this.map.delete(e):n.splice(i,1),!0}return!1}}get(e){var r;return(r=this.map.get(e))!==null&&r!==void 0?r:[]}has(e,r){if(r===void 0)return this.map.has(e);{let n=this.map.get(e);return n?n.indexOf(r)>=0:!1}}add(e,r){return this.map.has(e)?this.map.get(e).push(r):this.map.set(e,[r]),this}addAll(e,r){return this.map.has(e)?this.map.get(e).push(...r):this.map.set(e,Array.from(r)),this}forEach(e){this.map.forEach((r,n)=>r.forEach(i=>e(i,n,this)))}[Symbol.iterator](){return this.entries().iterator()}entries(){return pe(this.map.entries()).flatMap(([e,r])=>r.map(n=>[e,n]))}keys(){return pe(this.map.keys())}values(){return pe(this.map.values()).flat()}entriesGroupedByKey(){return pe(this.map.entries())}},Zo=class{get size(){return this.map.size}constructor(e){if(this.map=new Map,this.inverse=new Map,e)for(let[r,n]of e)this.set(r,n)}clear(){this.map.clear(),this.inverse.clear()}set(e,r){return this.map.set(e,r),this.inverse.set(r,e),this}get(e){return this.map.get(e)}getKey(e){return this.inverse.get(e)}delete(e){let r=this.map.get(e);return r!==void 0?(this.map.delete(e),this.inverse.delete(r),!0):!1}};var es=class{constructor(e){this.nameProvider=e.references.NameProvider,this.descriptions=e.workspace.AstNodeDescriptionProvider}async computeExports(e,r=re.CancellationToken.None){return this.computeExportsForNode(e.parseResult.value,e,void 0,r)}async computeExportsForNode(e,r,n=Do,i=re.CancellationToken.None){let o=[];this.exportNode(e,o,r);for(let s of n(e))await Ot(i),this.exportNode(s,o,r);return o}exportNode(e,r,n){let i=this.nameProvider.getName(e);i&&r.push(this.descriptions.createDescription(e,i,n))}async computeLocalScopes(e,r=re.CancellationToken.None){let n=e.parseResult.value,i=new hn;for(let o of jr(n))await Ot(r),this.processNode(o,e,i);return i}processNode(e,r,n){let i=e.$container;if(i){let o=this.nameProvider.getName(e);o&&n.add(i,this.descriptions.createDescription(e,o,r))}}};var $r=class{constructor(e,r,n){var i;this.elements=e,this.outerScope=r,this.caseInsensitive=(i=n==null?void 0:n.caseInsensitive)!==null&&i!==void 0?i:!1}getAllElements(){return this.outerScope?this.elements.concat(this.outerScope.getAllElements()):this.elements}getElement(e){let r=this.caseInsensitive?this.elements.find(n=>n.name.toLowerCase()===e.toLowerCase()):this.elements.find(n=>n.name===e);if(r)return r;if(this.outerScope)return this.outerScope.getElement(e)}},gu=class{constructor(e,r,n){var i;this.elements=new Map,this.caseInsensitive=(i=n==null?void 0:n.caseInsensitive)!==null&&i!==void 0?i:!1;for(let o of e){let s=this.caseInsensitive?o.name.toLowerCase():o.name;this.elements.set(s,o)}this.outerScope=r}getElement(e){let r=this.caseInsensitive?e.toLowerCase():e,n=this.elements.get(r);if(n)return n;if(this.outerScope)return this.outerScope.getElement(e)}getAllElements(){let e=pe(this.elements.values());return this.outerScope&&(e=e.concat(this.outerScope.getAllElements())),e}},EW={getElement(){},getAllElements(){return Bi}};var qa=class{constructor(){this.toDispose=[],this.isDisposed=!1}onDispose(e){this.toDispose.push(e)}dispose(){this.throwIfDisposed(),this.clear(),this.isDisposed=!0,this.toDispose.forEach(e=>e.dispose())}throwIfDisposed(){if(this.isDisposed)throw new Error("This cache has already been disposed")}},Tu=class extends qa{constructor(){super(...arguments),this.cache=new Map}has(e){return this.throwIfDisposed(),this.cache.has(e)}set(e,r){this.throwIfDisposed(),this.cache.set(e,r)}get(e,r){if(this.throwIfDisposed(),this.cache.has(e))return this.cache.get(e);if(r){let n=r();return this.cache.set(e,n),n}else return}delete(e){return this.throwIfDisposed(),this.cache.delete(e)}clear(){this.throwIfDisposed(),this.cache.clear()}},ts=class extends qa{constructor(e){super(),this.cache=new Map,this.converter=e!=null?e:r=>r}has(e,r){return this.throwIfDisposed(),this.cacheForContext(e).has(r)}set(e,r,n){this.throwIfDisposed(),this.cacheForContext(e).set(r,n)}get(e,r,n){this.throwIfDisposed();let i=this.cacheForContext(e);if(i.has(r))return i.get(r);if(n){let o=n();return i.set(r,o),o}else return}delete(e,r){return this.throwIfDisposed(),this.cacheForContext(e).delete(r)}clear(e){if(this.throwIfDisposed(),e){let r=this.converter(e);this.cache.delete(r)}else this.cache.clear()}cacheForContext(e){let r=this.converter(e),n=this.cache.get(r);return n||(n=new Map,this.cache.set(r,n)),n}},np=class extends ts{constructor(e){super(r=>r.toString()),this.onDispose(e.workspace.DocumentBuilder.onUpdate((r,n)=>{let i=r.concat(n);for(let o of i)this.clear(o)}))}},Ha=class extends Tu{constructor(e){super(),this.onDispose(e.workspace.DocumentBuilder.onUpdate(()=>{this.clear()}))}};var rs=class{constructor(e){this.reflection=e.shared.AstReflection,this.nameProvider=e.references.NameProvider,this.descriptions=e.workspace.AstNodeDescriptionProvider,this.indexManager=e.shared.workspace.IndexManager,this.globalScopeCache=new Ha(e.shared)}getScope(e){let r=[],n=this.reflection.getReferenceType(e),i=xt(e.container).precomputedScopes;if(i){let s=e.container;do{let a=i.get(s);a.length>0&&r.push(pe(a).filter(l=>this.reflection.isSubtype(l.type,n))),s=s.$container}while(s)}let o=this.getGlobalScope(n,e);for(let s=r.length-1;s>=0;s--)o=this.createScope(r[s],o);return o}createScope(e,r,n){return new $r(pe(e),r,n)}createScopeForNodes(e,r,n){let i=pe(e).map(o=>{let s=this.nameProvider.getName(o);if(s)return this.descriptions.createDescription(o,s)}).nonNullable();return new $r(i,r,n)}getGlobalScope(e,r){return this.globalScopeCache.get(e,()=>new gu(this.indexManager.allElements(e)))}};function Wy(t){return typeof t.$comment=="string"}function JD(t){return typeof t=="object"&&!!t&&("$ref"in t||"$error"in t)}var ns=class{constructor(e){this.ignoreProperties=new Set(["$container","$containerProperty","$containerIndex","$document","$cstNode"]),this.langiumDocuments=e.shared.workspace.LangiumDocuments,this.astNodeLocator=e.workspace.AstNodeLocator,this.nameProvider=e.references.NameProvider,this.commentProvider=e.documentation.CommentProvider}serialize(e,r={}){let n=r==null?void 0:r.replacer,i=(s,a)=>this.replacer(s,a,r),o=n?(s,a)=>n(s,a,i):i;try{return this.currentDocument=xt(e),JSON.stringify(e,o,r==null?void 0:r.space)}finally{this.currentDocument=void 0}}deserialize(e,r={}){let n=JSON.parse(e);return this.linkNode(n,n,r),n}replacer(e,r,{refText:n,sourceText:i,textRegions:o,comments:s,uriConverter:a}){var l,u,c,f;if(!this.ignoreProperties.has(e))if(Rt(r)){let d=r.ref,m=n?r.$refText:void 0;if(d){let _=xt(d),x="";this.currentDocument&&this.currentDocument!==_&&(a?x=a(_.uri,r):x=_.uri.toString());let A=this.astNodeLocator.getAstNodePath(d);return{$ref:`${x}#${A}`,$refText:m}}else return{$error:(u=(l=r.error)===null||l===void 0?void 0:l.message)!==null&&u!==void 0?u:"Could not resolve reference",$refText:m}}else if(Be(r)){let d;if(o&&(d=this.addAstNodeRegionWithAssignmentsTo(Object.assign({},r)),(!e||r.$document)&&(d!=null&&d.$textRegion)&&(d.$textRegion.documentURI=(c=this.currentDocument)===null||c===void 0?void 0:c.uri.toString())),i&&!e&&(d!=null||(d=Object.assign({},r)),d.$sourceText=(f=r.$cstNode)===null||f===void 0?void 0:f.text),s){d!=null||(d=Object.assign({},r));let m=this.commentProvider.getComment(r);m&&(d.$comment=m.replace(/\r/g,""))}return d!=null?d:r}else return r}addAstNodeRegionWithAssignmentsTo(e){let r=n=>({offset:n.offset,end:n.end,length:n.length,range:n.range});if(e.$cstNode){let n=e.$textRegion=r(e.$cstNode),i=n.assignments={};return Object.keys(e).filter(o=>!o.startsWith("$")).forEach(o=>{let s=Hs(e.$cstNode,o).map(r);s.length!==0&&(i[o]=s)}),e}}linkNode(e,r,n,i,o,s){for(let[l,u]of Object.entries(e))if(Array.isArray(u))for(let c=0;c<u.length;c++){let f=u[c];JD(f)?u[c]=this.reviveReference(e,l,r,f,n):Be(f)&&this.linkNode(f,r,n,e,l,c)}else JD(u)?e[l]=this.reviveReference(e,l,r,u,n):Be(u)&&this.linkNode(u,r,n,e,l);let a=e;a.$container=i,a.$containerProperty=o,a.$containerIndex=s}reviveReference(e,r,n,i,o){let s=i.$refText,a=i.$error;if(i.$ref){let l=this.getRefNode(n,i.$ref,o.uriConverter);if(Be(l))return s||(s=this.nameProvider.getName(l)),{$refText:s!=null?s:"",ref:l};a=l}if(a){let l={$refText:s!=null?s:""};return l.error={container:e,property:r,message:a,reference:l},l}else return}getRefNode(e,r,n){try{let i=r.indexOf("#");if(i===0){let l=this.astNodeLocator.getAstNode(e,r.substring(1));return l||"Could not resolve path: "+r}if(i<0){let l=n?n(r):Pe.parse(r),u=this.langiumDocuments.getDocument(l);return u?u.parseResult.value:"Could not find document for URI: "+r}let o=n?n(r.substring(0,i)):Pe.parse(r.substring(0,i)),s=this.langiumDocuments.getDocument(o);if(!s)return"Could not find document for URI: "+r;if(i===r.length-1)return s.parseResult.value;let a=this.astNodeLocator.getAstNode(s.parseResult.value,r.substring(i+1));return a||"Could not resolve URI: "+r}catch(i){return String(i)}}};var is=class{register(e){if(!this.singleton&&!this.map){this.singleton=e;return}if(!this.map&&(this.map={},this.singleton)){for(let r of this.singleton.LanguageMetaData.fileExtensions)this.map[r]=this.singleton;this.singleton=void 0}for(let r of e.LanguageMetaData.fileExtensions)this.map[r]!==void 0&&this.map[r]!==e&&console.warn(`The file extension ${r} is used by multiple languages. It is now assigned to '${e.LanguageMetaData.languageId}'.`),this.map[r]=e}getServices(e){if(this.singleton!==void 0)return this.singleton;if(this.map===void 0)throw new Error("The service registry is empty. Use `register` to register the services of a language.");let r=Vt.extname(e),n=this.map[r];if(!n)throw new Error(`The service registry contains no services for the extension '${r}'.`);return n}get all(){return this.singleton!==void 0?[this.singleton]:this.map!==void 0?Object.values(this.map):[]}};function ip(t){return{code:t}}var Ka;(function(t){t.all=["fast","slow","built-in"]})(Ka||(Ka={}));var yu=class{constructor(e){this.entries=new hn,this.reflection=e.shared.AstReflection}register(e,r=this,n="fast"){if(n==="built-in")throw new Error("The 'built-in' category is reserved for lexer, parser, and linker errors.");for(let[i,o]of Object.entries(e)){let s=o;if(Array.isArray(s))for(let a of s){let l={check:this.wrapValidationException(a,r),category:n};this.addEntry(i,l)}else if(typeof s=="function"){let a={check:this.wrapValidationException(s,r),category:n};this.addEntry(i,a)}}}wrapValidationException(e,r){return async(n,i,o)=>{try{await e.call(r,n,i,o)}catch(s){if(Zn(s))throw s;console.error("An error occurred during validation:",s);let a=s instanceof Error?s.message:String(s);s instanceof Error&&s.stack&&console.error(s.stack),i("error","An error occurred during validation: "+a,{node:n})}}}addEntry(e,r){if(e==="AstNode"){this.entries.add("AstNode",r);return}for(let n of this.reflection.getAllSubTypes(e))this.entries.add(n,r)}getChecks(e,r){let n=pe(this.entries.get(e)).concat(this.entries.get("AstNode"));return r&&(n=n.filter(i=>r.includes(i.category))),n.map(i=>i.check)}};var os=class{constructor(e){this.validationRegistry=e.validation.ValidationRegistry,this.metadata=e.LanguageMetaData}async validateDocument(e,r={},n=re.CancellationToken.None){let i=e.parseResult,o=[];if(await Ot(n),(!r.categories||r.categories.includes("built-in"))&&(this.processLexingErrors(i,o,r),r.stopAfterLexingErrors&&o.some(s=>{var a;return((a=s.data)===null||a===void 0?void 0:a.code)===vi.LexingError})||(this.processParsingErrors(i,o,r),r.stopAfterParsingErrors&&o.some(s=>{var a;return((a=s.data)===null||a===void 0?void 0:a.code)===vi.ParsingError}))||(this.processLinkingErrors(e,o,r),r.stopAfterLinkingErrors&&o.some(s=>{var a;return((a=s.data)===null||a===void 0?void 0:a.code)===vi.LinkingError}))))return o;try{o.push(...await this.validateAst(i.value,r,n))}catch(s){if(Zn(s))throw s;console.error("An error occurred during validation:",s)}return await Ot(n),o}processLexingErrors(e,r,n){for(let i of e.lexerErrors){let o={severity:op("error"),range:{start:{line:i.line-1,character:i.column-1},end:{line:i.line-1,character:i.column+i.length-1}},message:i.message,data:ip(vi.LexingError),source:this.getSource()};r.push(o)}}processParsingErrors(e,r,n){for(let i of e.parserErrors){let o;if(isNaN(i.token.startOffset)){if("previousToken"in i){let s=i.previousToken;if(isNaN(s.startOffset)){let a={line:0,character:0};o={start:a,end:a}}else{let a={line:s.endLine-1,character:s.endColumn};o={start:a,end:a}}}}else o=Gs(i.token);if(o){let s={severity:op("error"),range:o,message:i.message,data:ip(vi.ParsingError),source:this.getSource()};r.push(s)}}}processLinkingErrors(e,r,n){for(let i of e.references){let o=i.error;if(o){let s={node:o.container,property:o.property,index:o.index,data:{code:vi.LinkingError,containerType:o.container.$type,property:o.property,refText:o.reference.$refText}};r.push(this.toDiagnostic("error",o.message,s))}}}async validateAst(e,r,n=re.CancellationToken.None){let i=[],o=(s,a,l)=>{i.push(this.toDiagnostic(s,a,l))};return await Promise.all(qr(e).map(async s=>{await Ot(n);let a=this.validationRegistry.getChecks(s.$type,r.categories);for(let l of a)await l(s,o,n)})),i}toDiagnostic(e,r,n){return{message:r,range:QD(n),severity:op(e),code:n.code,codeDescription:n.codeDescription,tags:n.tags,relatedInformation:n.relatedInformation,data:n.data,source:this.getSource()}}getSource(){return this.metadata.languageId}};function QD(t){if(t.range)return t.range;let e;return typeof t.property=="string"?e=ji(t.node.$cstNode,t.property,t.index):typeof t.keyword=="string"&&(e=Ks(t.node.$cstNode,t.keyword,t.index)),e!=null||(e=t.node.$cstNode),e?e.range:{start:{line:0,character:0},end:{line:0,character:0}}}function op(t){switch(t){case"error":return 1;case"warning":return 2;case"info":return 3;case"hint":return 4;default:throw new Error("Invalid diagnostic severity: "+t)}}var vi;(function(t){t.LexingError="lexing-error",t.ParsingError="parsing-error",t.LinkingError="linking-error"})(vi||(vi={}));var _u=class{constructor(e){this.astNodeLocator=e.workspace.AstNodeLocator,this.nameProvider=e.references.NameProvider}createDescription(e,r,n=xt(e)){r!=null||(r=this.nameProvider.getName(e));let i=this.astNodeLocator.getAstNodePath(e);if(!r)throw new Error(`Node at path ${i} has no name.`);let o,s=()=>{var a;return o!=null?o:o=So((a=this.nameProvider.getNameNode(e))!==null&&a!==void 0?a:e.$cstNode)};return{node:e,name:r,get nameSegment(){return s()},selectionSegment:So(e.$cstNode),type:e.$type,documentUri:n.uri,path:i}}},ss=class{constructor(e){this.nodeLocator=e.workspace.AstNodeLocator}async createDescriptions(e,r=re.CancellationToken.None){let n=[],i=e.parseResult.value;for(let o of qr(i))await Ot(r),js(o).filter(s=>!Nn(s)).forEach(s=>{let a=this.createDescription(s);a&&n.push(a)});return n}createDescription(e){let r=e.reference.$nodeDescription,n=e.reference.$refNode;if(!r||!n)return;let i=xt(e.container).uri;return{sourceUri:i,sourcePath:this.nodeLocator.getAstNodePath(e.container),targetUri:r.documentUri,targetPath:r.path,segment:So(n),local:Vt.equals(r.documentUri,i)}}};var vu=class{constructor(){this.segmentSeparator="/",this.indexSeparator="@"}getAstNodePath(e){if(e.$container){let r=this.getAstNodePath(e.$container),n=this.getPathSegment(e);return r+this.segmentSeparator+n}return""}getPathSegment({$containerProperty:e,$containerIndex:r}){if(!e)throw new Error("Missing '$containerProperty' in AST node.");return r!==void 0?e+this.indexSeparator+r:e}getAstNode(e,r){return r.split(this.segmentSeparator).reduce((i,o)=>{if(!i||o.length===0)return i;let s=o.indexOf(this.indexSeparator);if(s>0){let a=o.substring(0,s),l=parseInt(o.substring(s+1)),u=i[a];return u==null?void 0:u[l]}return i[o]},e)}};var Ru=class{constructor(e){this._ready=new wr,this.settings={},this.workspaceConfig=!1,this.serviceRegistry=e.ServiceRegistry}get ready(){return this._ready.promise}initialize(e){var r,n;this.workspaceConfig=(n=(r=e.capabilities.workspace)===null||r===void 0?void 0:r.configuration)!==null&&n!==void 0?n:!1}async initialized(e){if(this.workspaceConfig){if(e.register){let r=this.serviceRegistry.all;e.register({section:r.map(n=>this.toSectionName(n.LanguageMetaData.languageId))})}if(e.fetchConfiguration){let r=this.serviceRegistry.all.map(i=>({section:this.toSectionName(i.LanguageMetaData.languageId)})),n=await e.fetchConfiguration(r);r.forEach((i,o)=>{this.updateSectionConfiguration(i.section,n[o])})}}this._ready.resolve()}updateConfiguration(e){e.settings&&Object.keys(e.settings).forEach(r=>{this.updateSectionConfiguration(r,e.settings[r])})}updateSectionConfiguration(e,r){this.settings[e]=r}async getConfiguration(e,r){await this.ready;let n=this.toSectionName(e);if(this.settings[n])return this.settings[n][r]}toSectionName(e){return`${e}`}};var as;(function(t){function e(r){return{dispose:async()=>await r()}}t.create=e})(as||(as={}));var xu=class{constructor(e){this.updateBuildOptions={validation:{categories:["built-in","fast"]}},this.updateListeners=[],this.buildPhaseListeners=new hn,this.buildState=new Map,this.documentBuildWaiters=new Map,this.currentState=ae.Changed,this.langiumDocuments=e.workspace.LangiumDocuments,this.langiumDocumentFactory=e.workspace.LangiumDocumentFactory,this.indexManager=e.workspace.IndexManager,this.serviceRegistry=e.ServiceRegistry}async build(e,r={},n=re.CancellationToken.None){var i,o;for(let s of e){let a=s.uri.toString();if(s.state===ae.Validated){if(typeof r.validation=="boolean"&&r.validation)s.state=ae.IndexedReferences,s.diagnostics=void 0,this.buildState.delete(a);else if(typeof r.validation=="object"){let l=this.buildState.get(a),u=(i=l==null?void 0:l.result)===null||i===void 0?void 0:i.validationChecks;if(u){let f=((o=r.validation.categories)!==null&&o!==void 0?o:Ka.all).filter(d=>!u.includes(d));f.length>0&&(this.buildState.set(a,{completed:!1,options:{validation:Object.assign(Object.assign({},r.validation),{categories:f})},result:l.result}),s.state=ae.IndexedReferences)}}}else this.buildState.delete(a)}this.currentState=ae.Changed,await this.emitUpdate(e.map(s=>s.uri),[]),await this.buildDocuments(e,r,n)}async update(e,r,n=re.CancellationToken.None){this.currentState=ae.Changed;for(let s of r)this.langiumDocuments.deleteDocument(s),this.buildState.delete(s.toString()),this.indexManager.remove(s);for(let s of e){if(!this.langiumDocuments.invalidateDocument(s)){let l=this.langiumDocumentFactory.fromModel({$type:"INVALID"},s);l.state=ae.Changed,this.langiumDocuments.addDocument(l)}this.buildState.delete(s.toString())}let i=pe(e).concat(r).map(s=>s.toString()).toSet();this.langiumDocuments.all.filter(s=>!i.has(s.uri.toString())&&this.shouldRelink(s,i)).forEach(s=>{this.serviceRegistry.getServices(s.uri).references.Linker.unlink(s),s.state=Math.min(s.state,ae.ComputedScopes),s.diagnostics=void 0}),await this.emitUpdate(e,r),await Ot(n);let o=this.langiumDocuments.all.filter(s=>{var a;return s.state<ae.Linked||!(!((a=this.buildState.get(s.uri.toString()))===null||a===void 0)&&a.completed)}).toArray();await this.buildDocuments(o,this.updateBuildOptions,n)}async emitUpdate(e,r){await Promise.all(this.updateListeners.map(n=>n(e,r)))}shouldRelink(e,r){return e.references.some(n=>n.error!==void 0)?!0:this.indexManager.isAffected(e,r)}onUpdate(e){return this.updateListeners.push(e),as.create(()=>{let r=this.updateListeners.indexOf(e);r>=0&&this.updateListeners.splice(r,1)})}async buildDocuments(e,r,n){this.prepareBuild(e,r),await this.runCancelable(e,ae.Parsed,n,o=>this.langiumDocumentFactory.update(o,n)),await this.runCancelable(e,ae.IndexedContent,n,o=>this.indexManager.updateContent(o,n)),await this.runCancelable(e,ae.ComputedScopes,n,async o=>{let s=this.serviceRegistry.getServices(o.uri).references.ScopeComputation;o.precomputedScopes=await s.computeLocalScopes(o,n)}),await this.runCancelable(e,ae.Linked,n,o=>this.serviceRegistry.getServices(o.uri).references.Linker.link(o,n)),await this.runCancelable(e,ae.IndexedReferences,n,o=>this.indexManager.updateReferences(o,n));let i=e.filter(o=>this.shouldValidate(o));await this.runCancelable(i,ae.Validated,n,o=>this.validate(o,n));for(let o of e){let s=this.buildState.get(o.uri.toString());s&&(s.completed=!0)}}prepareBuild(e,r){for(let n of e){let i=n.uri.toString(),o=this.buildState.get(i);(!o||o.completed)&&this.buildState.set(i,{completed:!1,options:r,result:o==null?void 0:o.result})}}async runCancelable(e,r,n,i){let o=e.filter(s=>s.state<r);for(let s of o)await Ot(n),await i(s),s.state=r;await this.notifyBuildPhase(o,r,n),this.currentState=r}onBuildPhase(e,r){return this.buildPhaseListeners.add(e,r),as.create(()=>{this.buildPhaseListeners.delete(e,r)})}waitUntil(e,r,n){let i;if(r&&"path"in r?i=r:n=r,n!=null||(n=re.CancellationToken.None),i){let o=this.langiumDocuments.getDocument(i);if(o&&o.state>e)return Promise.resolve(i)}return this.currentState>=e?Promise.resolve(void 0):n.isCancellationRequested?Promise.reject(Qn):new Promise((o,s)=>{let a=this.onBuildPhase(e,()=>{if(a.dispose(),l.dispose(),i){let u=this.langiumDocuments.getDocument(i);o(u==null?void 0:u.uri)}else o(void 0)}),l=n.onCancellationRequested(()=>{a.dispose(),l.dispose(),s(Qn)})})}async notifyBuildPhase(e,r,n){if(e.length===0)return;let i=this.buildPhaseListeners.get(r);for(let o of i)await Ot(n),await o(e,n)}shouldValidate(e){return!!this.getBuildOptions(e).validation}async validate(e,r){var n,i;let o=this.serviceRegistry.getServices(e.uri).validation.DocumentValidator,s=this.getBuildOptions(e).validation,a=typeof s=="object"?s:void 0,l=await o.validateDocument(e,a,r);e.diagnostics?e.diagnostics.push(...l):e.diagnostics=l;let u=this.buildState.get(e.uri.toString());if(u){(n=u.result)!==null&&n!==void 0||(u.result={});let c=(i=a==null?void 0:a.categories)!==null&&i!==void 0?i:Ka.all;u.result.validationChecks?u.result.validationChecks.push(...c):u.result.validationChecks=[...c]}}getBuildOptions(e){var r,n;return(n=(r=this.buildState.get(e.uri.toString()))===null||r===void 0?void 0:r.options)!==null&&n!==void 0?n:{}}};var Nu=class{constructor(e){this.symbolIndex=new Map,this.symbolByTypeIndex=new ts,this.referenceIndex=new Map,this.documents=e.workspace.LangiumDocuments,this.serviceRegistry=e.ServiceRegistry,this.astReflection=e.AstReflection}findAllReferences(e,r){let n=xt(e).uri,i=[];return this.referenceIndex.forEach(o=>{o.forEach(s=>{Vt.equals(s.targetUri,n)&&s.targetPath===r&&i.push(s)})}),pe(i)}allElements(e,r){let n=pe(this.symbolIndex.keys());return r&&(n=n.filter(i=>!r||r.has(i))),n.map(i=>this.getFileDescriptions(i,e)).flat()}getFileDescriptions(e,r){var n;return r?this.symbolByTypeIndex.get(e,r,()=>{var o;return((o=this.symbolIndex.get(e))!==null&&o!==void 0?o:[]).filter(a=>this.astReflection.isSubtype(a.type,r))}):(n=this.symbolIndex.get(e))!==null&&n!==void 0?n:[]}remove(e){let r=e.toString();this.symbolIndex.delete(r),this.symbolByTypeIndex.clear(r),this.referenceIndex.delete(r)}async updateContent(e,r=re.CancellationToken.None){let i=await this.serviceRegistry.getServices(e.uri).references.ScopeComputation.computeExports(e,r),o=e.uri.toString();this.symbolIndex.set(o,i),this.symbolByTypeIndex.clear(o)}async updateReferences(e,r=re.CancellationToken.None){let i=await this.serviceRegistry.getServices(e.uri).workspace.ReferenceDescriptionProvider.createDescriptions(e,r);this.referenceIndex.set(e.uri.toString(),i)}isAffected(e,r){let n=this.referenceIndex.get(e.uri.toString());return n?n.some(i=>!i.local&&r.has(i.targetUri.toString())):!1}};var Eu=class{constructor(e){this.initialBuildOptions={},this._ready=new wr,this.serviceRegistry=e.ServiceRegistry,this.langiumDocuments=e.workspace.LangiumDocuments,this.documentBuilder=e.workspace.DocumentBuilder,this.fileSystemProvider=e.workspace.FileSystemProvider,this.mutex=e.workspace.WorkspaceLock}get ready(){return this._ready.promise}initialize(e){var r;this.folders=(r=e.workspaceFolders)!==null&&r!==void 0?r:void 0}initialized(e){return this.mutex.write(r=>{var n;return this.initializeWorkspace((n=this.folders)!==null&&n!==void 0?n:[],r)})}async initializeWorkspace(e,r=re.CancellationToken.None){let n=await this.performStartup(e);await Ot(r),await this.documentBuilder.build(n,this.initialBuildOptions,r)}async performStartup(e){let r=this.serviceRegistry.all.flatMap(o=>o.LanguageMetaData.fileExtensions),n=[],i=o=>{n.push(o),this.langiumDocuments.hasDocument(o.uri)||this.langiumDocuments.addDocument(o)};return await this.loadAdditionalDocuments(e,i),await Promise.all(e.map(o=>[o,this.getRootFolder(o)]).map(async o=>this.traverseFolder(...o,r,i))),this._ready.resolve(),n}loadAdditionalDocuments(e,r){return Promise.resolve()}getRootFolder(e){return Pe.parse(e.uri)}async traverseFolder(e,r,n,i){let o=await this.fileSystemProvider.readDirectory(r);await Promise.all(o.map(async s=>{if(this.includeEntry(e,s,n)){if(s.isDirectory)await this.traverseFolder(e,s.uri,n,i);else if(s.isFile){let a=await this.langiumDocuments.getOrCreateDocument(s.uri);i(a)}}}))}includeEntry(e,r,n){let i=Vt.basename(r.uri);if(i.startsWith("."))return!1;if(r.isDirectory)return i!=="node_modules"&&i!=="out";if(r.isFile){let o=Vt.extname(r.uri);return n.includes(o)}return!1}};var Iu=class{constructor(e){let r=e.parser.TokenBuilder.buildTokens(e.Grammar,{caseInsensitive:e.LanguageMetaData.caseInsensitive});this.tokenTypes=this.toTokenTypeDictionary(r);let n=Gy(r)?Object.values(r):r;this.chevrotainLexer=new kt(n,{positionTracking:"full"})}get definition(){return this.tokenTypes}tokenize(e){var r;let n=this.chevrotainLexer.tokenize(e);return{tokens:n.tokens,errors:n.errors,hidden:(r=n.groups.hidden)!==null&&r!==void 0?r:[]}}toTokenTypeDictionary(e){if(Gy(e))return e;let r=jy(e)?Object.values(e.modes).flat():e,n={};return r.forEach(i=>n[i.name]=i),n}};function ZD(t){return Array.isArray(t)&&(t.length===0||"name"in t[0])}function jy(t){return t&&"modes"in t&&"defaultMode"in t}function Gy(t){return!ZD(t)&&!jy(t)}function Ky(t,e,r){let n,i;typeof t=="string"?(i=e,n=r):(i=t.range.start,n=e),i||(i=ke.create(0,0));let o=rC(t),s=Yy(n),a=OW({lines:o,position:i,options:s});return bW({index:0,tokens:a,position:i})}function zy(t,e){let r=Yy(e),n=rC(t);if(n.length===0)return!1;let i=n[0],o=n[n.length-1],s=r.start,a=r.end;return!!(s!=null&&s.exec(i))&&!!(a!=null&&a.exec(o))}function rC(t){let e="";return typeof t=="string"?e=t:e=t.text,e.split(uT)}var eC=/\s*(@([\p{L}][\p{L}\p{N}]*)?)/uy,IW=/\{(@[\p{L}][\p{L}\p{N}]*)(\s*)([^\r\n}]+)?\}/gu;function OW(t){var e,r,n;let i=[],o=t.position.line,s=t.position.character;for(let a=0;a<t.lines.length;a++){let l=a===0,u=a===t.lines.length-1,c=t.lines[a],f=0;if(l&&t.options.start){let m=(e=t.options.start)===null||e===void 0?void 0:e.exec(c);m&&(f=m.index+m[0].length)}else{let m=(r=t.options.line)===null||r===void 0?void 0:r.exec(c);m&&(f=m.index+m[0].length)}if(u){let m=(n=t.options.end)===null||n===void 0?void 0:n.exec(c);m&&(c=c.substring(0,m.index))}if(c=c.substring(0,CW(c)),Hy(c,f)>=c.length){if(i.length>0){let m=ke.create(o,s);i.push({type:"break",content:"",range:Ae.create(m,m)})}}else{eC.lastIndex=f;let m=eC.exec(c);if(m){let _=m[0],x=m[1],A=ke.create(o,s+f),I=ke.create(o,s+f+_.length);i.push({type:"tag",content:x,range:Ae.create(A,I)}),f+=_.length,f=Hy(c,f)}if(f<c.length){let _=c.substring(f),x=Array.from(_.matchAll(IW));i.push(...AW(x,_,o,s+f))}}o++,s=0}return i.length>0&&i[i.length-1].type==="break"?i.slice(0,-1):i}function AW(t,e,r,n){let i=[];if(t.length===0){let o=ke.create(r,n),s=ke.create(r,n+e.length);i.push({type:"text",content:e,range:Ae.create(o,s)})}else{let o=0;for(let a of t){let l=a.index,u=e.substring(o,l);u.length>0&&i.push({type:"text",content:e.substring(o,l),range:Ae.create(ke.create(r,o+n),ke.create(r,l+n))});let c=u.length+1,f=a[1];if(i.push({type:"inline-tag",content:f,range:Ae.create(ke.create(r,o+c+n),ke.create(r,o+c+f.length+n))}),c+=f.length,a.length===4){c+=a[2].length;let d=a[3];i.push({type:"text",content:d,range:Ae.create(ke.create(r,o+c+n),ke.create(r,o+c+d.length+n))})}else i.push({type:"text",content:"",range:Ae.create(ke.create(r,o+c+n),ke.create(r,o+c+n))});o=l+a[0].length}let s=e.substring(o);s.length>0&&i.push({type:"text",content:s,range:Ae.create(ke.create(r,o+n),ke.create(r,o+n+s.length))})}return i}var SW=/\S/,DW=/\s*$/;function Hy(t,e){let r=t.substring(e).match(SW);return r?e+r.index:t.length}function CW(t){let e=t.match(DW);if(e&&typeof e.index=="number")return e.index}function bW(t){var e,r,n,i;let o=ke.create(t.position.line,t.position.character);if(t.tokens.length===0)return new sp([],Ae.create(o,o));let s=[];for(;t.index<t.tokens.length;){let u=LW(t,s[s.length-1]);u&&s.push(u)}let a=(r=(e=s[0])===null||e===void 0?void 0:e.range.start)!==null&&r!==void 0?r:o,l=(i=(n=s[s.length-1])===null||n===void 0?void 0:n.range.end)!==null&&i!==void 0?i:o;return new sp(s,Ae.create(a,l))}function LW(t,e){let r=t.tokens[t.index];if(r.type==="tag")return iC(t,!1);if(r.type==="text"||r.type==="inline-tag")return nC(t);kW(r,e),t.index++}function kW(t,e){if(e){let r=new ap("",t.range);"inlines"in e?e.inlines.push(r):e.content.inlines.push(r)}}function nC(t){let e=t.tokens[t.index],r=e,n=e,i=[];for(;e&&e.type!=="break"&&e.type!=="tag";)i.push(wW(t)),n=e,e=t.tokens[t.index];return new Au(i,Ae.create(r.range.start,n.range.end))}function wW(t){return t.tokens[t.index].type==="inline-tag"?iC(t,!0):oC(t)}function iC(t,e){let r=t.tokens[t.index++],n=r.content.substring(1),i=t.tokens[t.index];if((i==null?void 0:i.type)==="text")if(e){let o=oC(t);return new Ou(n,new Au([o],o.range),e,Ae.create(r.range.start,o.range.end))}else{let o=nC(t);return new Ou(n,o,e,Ae.create(r.range.start,o.range.end))}else{let o=r.range;return new Ou(n,new Au([],o),e,o)}}function oC(t){let e=t.tokens[t.index++];return new ap(e.content,e.range)}function Yy(t){if(!t)return Yy({start:"/**",end:"*/",line:"*"});let{start:e,end:r,line:n}=t;return{start:qy(e,!0),end:qy(r,!1),line:qy(n,!0)}}function qy(t,e){if(typeof t=="string"||typeof t=="object"){let r=typeof t=="string"?wo(t):t.source;return e?new RegExp(`^\\s*${r}`):new RegExp(`\\s*${r}\\s*$`)}else return t}var sp=class{constructor(e,r){this.elements=e,this.range=r}getTag(e){return this.getAllTags().find(r=>r.name===e)}getTags(e){return this.getAllTags().filter(r=>r.name===e)}getAllTags(){return this.elements.filter(e=>"name"in e)}toString(){let e="";for(let r of this.elements)if(e.length===0)e=r.toString();else{let n=r.toString();e+=tC(e)+n}return e.trim()}toMarkdown(e){let r="";for(let n of this.elements)if(r.length===0)r=n.toMarkdown(e);else{let i=n.toMarkdown(e);r+=tC(r)+i}return r.trim()}},Ou=class{constructor(e,r,n,i){this.name=e,this.content=r,this.inline=n,this.range=i}toString(){let e=`@${this.name}`,r=this.content.toString();return this.content.inlines.length===1?e=`${e} ${r}`:this.content.inlines.length>1&&(e=`${e}
${r}`),this.inline?`{${e}}`:e}toMarkdown(e){var r,n;return(n=(r=e==null?void 0:e.renderTag)===null||r===void 0?void 0:r.call(e,this))!==null&&n!==void 0?n:this.toMarkdownDefault(e)}toMarkdownDefault(e){let r=this.content.toMarkdown(e);if(this.inline){let o=$W(this.name,r,e!=null?e:{});if(typeof o=="string")return o}let n="";(e==null?void 0:e.tag)==="italic"||(e==null?void 0:e.tag)===void 0?n="*":(e==null?void 0:e.tag)==="bold"?n="**":(e==null?void 0:e.tag)==="bold-italic"&&(n="***");let i=`${n}@${this.name}${n}`;return this.content.inlines.length===1?i=`${i} \u2014 ${r}`:this.content.inlines.length>1&&(i=`${i}
${r}`),this.inline?`{${i}}`:i}};function $W(t,e,r){var n,i;if(t==="linkplain"||t==="linkcode"||t==="link"){let o=e.indexOf(" "),s=e;if(o>0){let l=Hy(e,o);s=e.substring(l),e=e.substring(0,o)}return(t==="linkcode"||t==="link"&&r.link==="code")&&(s=`\`${s}\``),(i=(n=r.renderLink)===null||n===void 0?void 0:n.call(r,e,s))!==null&&i!==void 0?i:PW(e,s)}}function PW(t,e){try{return Pe.parse(t,!0),`[${e}](${t})`}catch{return t}}var Au=class{constructor(e,r){this.inlines=e,this.range=r}toString(){let e="";for(let r=0;r<this.inlines.length;r++){let n=this.inlines[r],i=this.inlines[r+1];e+=n.toString(),i&&i.range.start.line>n.range.start.line&&(e+=`
`)}return e}toMarkdown(e){let r="";for(let n=0;n<this.inlines.length;n++){let i=this.inlines[n],o=this.inlines[n+1];r+=i.toMarkdown(e),o&&o.range.start.line>i.range.start.line&&(r+=`
`)}return r}},ap=class{constructor(e,r){this.text=e,this.range=r}toString(){return this.text}toMarkdown(){return this.text}};function tC(t){return t.endsWith(`
`)?`
`:`

`}var Su=class{constructor(e){this.indexManager=e.shared.workspace.IndexManager,this.commentProvider=e.documentation.CommentProvider}getDocumentation(e){let r=this.commentProvider.getComment(e);if(r&&zy(r))return Ky(r).toMarkdown({renderLink:(i,o)=>this.documentationLinkRenderer(e,i,o),renderTag:i=>this.documentationTagRenderer(e,i)})}documentationLinkRenderer(e,r,n){var i;let o=(i=this.findNameInPrecomputedScopes(e,r))!==null&&i!==void 0?i:this.findNameInGlobalScope(e,r);if(o&&o.nameSegment){let s=o.nameSegment.range.start.line+1,a=o.nameSegment.range.start.character+1,l=o.documentUri.with({fragment:`L${s},${a}`});return`[${n}](${l.toString()})`}else return}documentationTagRenderer(e,r){}findNameInPrecomputedScopes(e,r){let i=xt(e).precomputedScopes;if(!i)return;let o=e;do{let a=i.get(o).find(l=>l.name===r);if(a)return a;o=o.$container}while(o)}findNameInGlobalScope(e,r){return this.indexManager.allElements().find(i=>i.name===r)}};var Du=class{constructor(e){this.grammarConfig=()=>e.parser.GrammarConfig}getComment(e){var r;return Wy(e)?e.$comment:(r=tT(e.$cstNode,this.grammarConfig().multilineCommentRules))===null||r===void 0?void 0:r.text}};var wt={};De(wt,yt(Py(),1));var Cu=class{constructor(e){this.syncParser=e.parser.LangiumParser}parse(e){return Promise.resolve(this.syncParser.parse(e))}},lp=class{constructor(e){this.threadCount=8,this.terminationDelay=200,this.workerPool=[],this.queue=[],this.hydrator=e.serializer.Hydrator}initializeWorkers(){for(;this.workerPool.length<this.threadCount;){let e=this.createWorker();e.onReady(()=>{if(this.queue.length>0){let r=this.queue.shift();r&&(e.lock(),r.resolve(e))}}),this.workerPool.push(e)}}async parse(e,r){let n=await this.acquireParserWorker(r),i=new wr,o,s=r.onCancellationRequested(()=>{o=setTimeout(()=>{this.terminateWorker(n)},this.terminationDelay)});return n.parse(e).then(a=>{let l=this.hydrator.hydrate(a);i.resolve(l)}).catch(a=>{i.reject(a)}).finally(()=>{s.dispose(),clearTimeout(o)}),i.promise}terminateWorker(e){e.terminate();let r=this.workerPool.indexOf(e);r>=0&&this.workerPool.splice(r,1)}async acquireParserWorker(e){this.initializeWorkers();for(let n of this.workerPool)if(n.ready)return n.lock(),n;let r=new wr;return e.onCancellationRequested(()=>{let n=this.queue.indexOf(r);n>=0&&this.queue.splice(n,1),r.reject(Qn)}),this.queue.push(r),r.promise}},up=class{get ready(){return this._ready}get onReady(){return this.onReadyEmitter.event}constructor(e,r,n,i){this.onReadyEmitter=new wt.Emitter,this.deferred=new wr,this._ready=!0,this._parsing=!1,this.sendMessage=e,this._terminate=i,r(o=>{let s=o;this.deferred.resolve(s),this.unlock()}),n(o=>{this.deferred.reject(o),this.unlock()})}terminate(){this.deferred.reject(Qn),this._terminate()}lock(){this._ready=!1}unlock(){this._parsing=!1,this._ready=!0,this.onReadyEmitter.fire()}parse(e){if(this._parsing)throw new Error("Parser worker is busy");return this._parsing=!0,this.deferred=new wr,this.sendMessage(e),this.deferred.promise}};var bu=class{constructor(){this.previousTokenSource=new re.CancellationTokenSource,this.writeQueue=[],this.readQueue=[],this.done=!0}write(e){this.cancelWrite();let r=new re.CancellationTokenSource;return this.previousTokenSource=r,this.enqueue(this.writeQueue,e,r.token)}read(e){return this.enqueue(this.readQueue,e)}enqueue(e,r,n){let i=new wr,o={action:r,deferred:i,cancellationToken:n!=null?n:re.CancellationToken.None};return e.push(o),this.performNextOperation(),i.promise}async performNextOperation(){if(!this.done)return;let e=[];if(this.writeQueue.length>0)e.push(this.writeQueue.shift());else if(this.readQueue.length>0)e.push(...this.readQueue.splice(0,this.readQueue.length));else return;this.done=!1,await Promise.all(e.map(async({action:r,deferred:n,cancellationToken:i})=>{try{let o=await Promise.resolve().then(()=>r(i));n.resolve(o)}catch(o){Zn(o)?n.resolve(void 0):n.reject(o)}})),this.done=!0,this.performNextOperation()}cancelWrite(){this.previousTokenSource.cancel()}};var Lu=class{constructor(e){this.grammarElementIdMap=new Zo,this.tokenTypeIdMap=new Zo,this.grammar=e.Grammar,this.lexer=e.parser.Lexer,this.linker=e.references.Linker}dehydrate(e){return{lexerErrors:e.lexerErrors.map(r=>Object.assign({},r)),parserErrors:e.parserErrors.map(r=>Object.assign({},r)),value:this.dehydrateAstNode(e.value,this.createDehyrationContext(e.value))}}createDehyrationContext(e){let r=new Map,n=new Map;for(let i of qr(e))r.set(i,{});if(e.$cstNode)for(let i of Ao(e.$cstNode))n.set(i,{});return{astNodes:r,cstNodes:n}}dehydrateAstNode(e,r){let n=r.astNodes.get(e);n.$type=e.$type,n.$containerIndex=e.$containerIndex,n.$containerProperty=e.$containerProperty,e.$cstNode!==void 0&&(n.$cstNode=this.dehydrateCstNode(e.$cstNode,r));for(let[i,o]of Object.entries(e))if(!i.startsWith("$"))if(Array.isArray(o)){let s=[];n[i]=s;for(let a of o)Be(a)?s.push(this.dehydrateAstNode(a,r)):Rt(a)?s.push(this.dehydrateReference(a,r)):s.push(a)}else Be(o)?n[i]=this.dehydrateAstNode(o,r):Rt(o)?n[i]=this.dehydrateReference(o,r):o!==void 0&&(n[i]=o);return n}dehydrateReference(e,r){let n={};return n.$refText=e.$refText,e.$refNode&&(n.$refNode=r.cstNodes.get(e.$refNode)),n}dehydrateCstNode(e,r){let n=r.cstNodes.get(e);return vl(e)?n.fullText=e.fullText:n.grammarSource=this.getGrammarElementId(e.grammarSource),n.hidden=e.hidden,n.astNode=r.astNodes.get(e.astNode),Ar(e)?n.content=e.content.map(i=>this.dehydrateCstNode(i,r)):En(e)&&(n.tokenType=e.tokenType.name,n.offset=e.offset,n.length=e.length,n.startLine=e.range.start.line,n.startColumn=e.range.start.character,n.endLine=e.range.end.line,n.endColumn=e.range.end.character),n}hydrate(e){let r=e.value,n=this.createHydrationContext(r);return"$cstNode"in r&&this.hydrateCstNode(r.$cstNode,n),{lexerErrors:e.lexerErrors,parserErrors:e.parserErrors,value:this.hydrateAstNode(r,n)}}createHydrationContext(e){let r=new Map,n=new Map;for(let o of qr(e))r.set(o,{});let i;if(e.$cstNode)for(let o of Ao(e.$cstNode)){let s;"fullText"in o?(s=new Ba(o.fullText),i=s):"content"in o?s=new zo:"tokenType"in o&&(s=this.hydrateCstLeafNode(o)),s&&(n.set(o,s),s.root=i)}return{astNodes:r,cstNodes:n}}hydrateAstNode(e,r){let n=r.astNodes.get(e);n.$type=e.$type,n.$containerIndex=e.$containerIndex,n.$containerProperty=e.$containerProperty,e.$cstNode&&(n.$cstNode=r.cstNodes.get(e.$cstNode));for(let[i,o]of Object.entries(e))if(!i.startsWith("$"))if(Array.isArray(o)){let s=[];n[i]=s;for(let a of o)Be(a)?s.push(this.setParent(this.hydrateAstNode(a,r),n)):Rt(a)?s.push(this.hydrateReference(a,n,i,r)):s.push(a)}else Be(o)?n[i]=this.setParent(this.hydrateAstNode(o,r),n):Rt(o)?n[i]=this.hydrateReference(o,n,i,r):o!==void 0&&(n[i]=o);return n}setParent(e,r){return e.$container=r,e}hydrateReference(e,r,n,i){return this.linker.buildReference(r,n,i.cstNodes.get(e.$refNode),e.$refText)}hydrateCstNode(e,r,n=0){let i=r.cstNodes.get(e);if(typeof e.grammarSource=="number"&&(i.grammarSource=this.getGrammarElement(e.grammarSource)),i.astNode=r.astNodes.get(e.astNode),Ar(i))for(let o of e.content){let s=this.hydrateCstNode(o,r,n++);i.content.push(s)}return i}hydrateCstLeafNode(e){let r=this.getTokenType(e.tokenType),n=e.offset,i=e.length,o=e.startLine,s=e.startColumn,a=e.endLine,l=e.endColumn,u=e.hidden;return new Ko(n,i,{start:{line:o,character:s},end:{line:a,character:l}},r,u)}getTokenType(e){return this.lexer.definition[e]}getGrammarElementId(e){return this.grammarElementIdMap.size===0&&this.createGrammarElementIdMap(),this.grammarElementIdMap.get(e)}getGrammarElement(e){this.grammarElementIdMap.size===0&&this.createGrammarElementIdMap();let r=this.grammarElementIdMap.getKey(e);if(r)return r;throw new Error("Invalid grammar element id: "+e)}createGrammarElementIdMap(){let e=0;for(let r of qr(this.grammar))Oo(r)&&this.grammarElementIdMap.set(r,e++)}};function ku(t){return{documentation:{CommentProvider:e=>new Du(e),DocumentationProvider:e=>new Su(e)},parser:{AsyncParser:e=>new Cu(e),GrammarConfig:e=>ET(e),LangiumParser:e=>Cy(e),CompletionParser:e=>Dy(e),ValueConverter:()=>new pu,TokenBuilder:()=>new du,Lexer:e=>new Iu(e),ParserErrorMessageProvider:()=>new Wa},workspace:{AstNodeLocator:()=>new vu,AstNodeDescriptionProvider:e=>new _u(e),ReferenceDescriptionProvider:e=>new ss(e)},references:{Linker:e=>new Xo(e),NameProvider:()=>new Jo,ScopeProvider:e=>new rs(e),ScopeComputation:e=>new es(e),References:e=>new Qo(e)},serializer:{Hydrator:e=>new Lu(e),JsonSerializer:e=>new ns(e)},validation:{DocumentValidator:e=>new os(e),ValidationRegistry:e=>new yu(e)},shared:()=>t.shared}}function wu(t){return{ServiceRegistry:()=>new is,workspace:{LangiumDocuments:e=>new hu(e),LangiumDocumentFactory:e=>new mu(e),DocumentBuilder:e=>new xu(e),IndexManager:e=>new Nu(e),WorkspaceManager:e=>new Eu(e),FileSystemProvider:e=>t.fileSystemProvider(e),WorkspaceLock:()=>new bu,ConfigurationProvider:e=>new Ru(e)}}}var za;(function(t){t.merge=(e,r)=>cp(cp({},e),r)})(za||(za={}));function ls(t,e,r,n,i,o,s,a,l){let u=[t,e,r,n,i,o,s,a,l].reduce(cp,{});return lC(u)}var Xy=Symbol("isProxy");function $u(t){if(t&&t[Xy])for(let e of Object.values(t))$u(e);return t}function lC(t,e){let r=new Proxy({},{deleteProperty:()=>!1,get:(n,i)=>aC(n,i,t,e||r),getOwnPropertyDescriptor:(n,i)=>(aC(n,i,t,e||r),Object.getOwnPropertyDescriptor(n,i)),has:(n,i)=>i in t,ownKeys:()=>[...Reflect.ownKeys(t),Xy]});return r[Xy]=!0,r}var sC=Symbol();function aC(t,e,r,n){if(e in t){if(t[e]instanceof Error)throw new Error("Construction failure. Please make sure that your dependencies are constructable.",{cause:t[e]});if(t[e]===sC)throw new Error('Cycle detected. Please make "'+String(e)+'" lazy. See https://langium.org/docs/configuration-services/#resolving-cyclic-dependencies');return t[e]}else if(e in r){let i=r[e];t[e]=sC;try{t[e]=typeof i=="function"?i(n):lC(i,n)}catch(o){throw t[e]=o instanceof Error?o:void 0,o}return t[e]}else return}function cp(t,e){if(e){for(let[r,n]of Object.entries(e))if(n!==void 0){let i=t[r];i!==null&&n!==null&&typeof i=="object"&&typeof n=="object"?t[r]=cp(i,n):t[r]=n}}return t}var uC=yt(Or(),1);var Ya=class{constructor(e){this.references=e.references.References,this.nameProvider=e.references.NameProvider,this.grammarConfig=e.parser.GrammarConfig}getDocumentHighlight(e,r){let n=e.parseResult.value.$cstNode;if(!n)return;let i=rr(n,e.textDocument.offsetAt(r.position),this.grammarConfig.nameRegexp);if(!i)return;let o=this.references.findDeclaration(i);if(o){let s=Vt.equals(xt(o).uri,e.uri),a={documentUri:e.uri,includeDeclaration:s};return this.references.findReferences(o,a).map(u=>this.createDocumentHighlight(u)).toArray()}}createDocumentHighlight(e){return uC.DocumentHighlight.create(e.segment.range)}};var fp=class{constructor(e){this.nameProvider=e.references.NameProvider,this.nodeKindProvider=e.shared.lsp.NodeKindProvider}getSymbols(e){return this.getSymbol(e,e.parseResult.value)}getSymbol(e,r){let n=r.$cstNode,i=this.nameProvider.getNameNode(r);if(i&&n){let o=this.nameProvider.getName(r);return[{kind:this.nodeKindProvider.getSymbolKind(r),name:o!=null?o:i.text,range:n.range,selectionRange:i.range,children:this.getChildSymbols(e,r)}]}else return this.getChildSymbols(e,r)||[]}getChildSymbols(e,r){let n=[];for(let i of Do(r)){let o=this.getSymbol(e,i);n.push(...o)}if(n.length>0)return n}};var Pu=yt(Or(),1);var dp=class{constructor(e){this.workspaceManager=e.workspace.WorkspaceManager,this.documentBuilder=e.workspace.DocumentBuilder,this.workspaceLock=e.workspace.WorkspaceLock;let r=!1;e.lsp.LanguageServer.onInitialize(n=>{var i,o;r=!!(!((o=(i=n.capabilities.workspace)===null||i===void 0?void 0:i.didChangeWatchedFiles)===null||o===void 0)&&o.dynamicRegistration)}),e.lsp.LanguageServer.onInitialized(n=>{r&&this.registerFileWatcher(e)})}registerFileWatcher(e){let r=pe(e.ServiceRegistry.all).flatMap(n=>n.LanguageMetaData.fileExtensions).map(n=>n.startsWith(".")?n.substring(1):n).distinct().toArray();if(r.length>0){let n=e.lsp.Connection,i={watchers:[{globPattern:r.length===1?`**/*.${r[0]}`:`**/*.{${r.join(",")}}`}]};n==null||n.client.register(Pu.DidChangeWatchedFilesNotification.type,i)}}fireDocumentUpdate(e,r){this.workspaceManager.ready.then(()=>{this.workspaceLock.write(n=>this.documentBuilder.update(e,r,n))}).catch(n=>{console.error("Workspace initialization failed. Could not perform document update.",n)})}didChangeContent(e){this.fireDocumentUpdate([Pe.parse(e.document.uri)],[])}didChangeWatchedFiles(e){let r=pe(e.changes).filter(i=>i.type!==Pu.FileChangeType.Deleted).distinct(i=>i.uri).map(i=>Pe.parse(i.uri)).toArray(),n=pe(e.changes).filter(i=>i.type===Pu.FileChangeType.Deleted).distinct(i=>i.uri).map(i=>Pe.parse(i.uri)).toArray();this.fireDocumentUpdate(r,n)}};var Mu=yt(Or(),1);var pp=class{constructor(e){this.commentNames=e.parser.GrammarConfig.multilineCommentRules}getFoldingRanges(e){let r=[],n=i=>r.push(i);return this.collectFolding(e,n),r}collectFolding(e,r){var n;let i=(n=e.parseResult)===null||n===void 0?void 0:n.value;if(i){if(this.shouldProcessContent(i)){let o=jr(i).iterator(),s;do if(s=o.next(),!s.done){let a=s.value;this.shouldProcess(a)&&this.collectObjectFolding(e,a,r),this.shouldProcessContent(a)||o.prune()}while(!s.done)}this.collectCommentFolding(e,i,r)}}shouldProcess(e){return!0}shouldProcessContent(e){return!0}collectObjectFolding(e,r,n){let i=r.$cstNode;if(i){let o=this.toFoldingRange(e,i);o&&n(o)}}collectCommentFolding(e,r,n){let i=r.$cstNode;if(i){for(let o of Zg(i))if(this.commentNames.includes(o.tokenType.name)){let s=this.toFoldingRange(e,o,Mu.FoldingRangeKind.Comment);s&&n(s)}}}toFoldingRange(e,r,n){let i=r.range,o=i.start,s=i.end;if(!(s.line-o.line<2))return this.includeLastFoldingLine(r,n)||(s=e.textDocument.positionAt(e.textDocument.offsetAt({line:s.line,character:0})-1)),Mu.FoldingRange.create(o.line,s.line,o.character,s.character,n)}includeLastFoldingLine(e,r){if(r===Mu.FoldingRangeKind.Comment)return!1;let n=e.text,i=n.charAt(n.length-1);return!(i==="}"||i===")"||i==="]")}};var mp=class{match(e,r){if(e.length===0)return!0;r=r.toLowerCase();let n=!1,i,o=0,s=r.length;for(let a=0;a<s;a++){let l=r.charCodeAt(a),u=e.charCodeAt(o);if((l===u||this.toUpperCharCode(l)===this.toUpperCharCode(u))&&(n||(n=i===void 0||this.isWordTransition(i,l)),n&&o++,o===e.length))return!0;i=l}return!1}isWordTransition(e,r){return cC<=e&&e<=fC&&MW<=r&&r<=FW||e===dC&&r!==dC}toUpperCharCode(e){return cC<=e&&e<=fC?e-32:e}},cC=97,fC=122,MW=65,FW=90,dC=95;var Jy=class{constructor(e){this.references=e.references.References,this.grammarConfig=e.parser.GrammarConfig}getHoverContent(e,r){var n,i;let o=(i=(n=e.parseResult)===null||n===void 0?void 0:n.value)===null||i===void 0?void 0:i.$cstNode;if(o){let s=e.textDocument.offsetAt(r.position),a=rr(o,s,this.grammarConfig.nameRegexp);if(a&&a.offset+a.length>s){let l=this.references.findDeclaration(a);if(l)return this.getAstNodeHoverContent(l)}}}},hp=class extends Jy{constructor(e){super(e),this.documentationProvider=e.documentation.DocumentationProvider}getAstNodeHoverContent(e){let r=this.documentationProvider.getDocumentation(e);if(r)return{contents:{kind:"markdown",value:r}}}};var gn=yt(vt(),1);var Ne=yt(Or(),1);var mC={[Ne.SemanticTokenTypes.class]:0,[Ne.SemanticTokenTypes.comment]:1,[Ne.SemanticTokenTypes.enum]:2,[Ne.SemanticTokenTypes.enumMember]:3,[Ne.SemanticTokenTypes.event]:4,[Ne.SemanticTokenTypes.function]:5,[Ne.SemanticTokenTypes.interface]:6,[Ne.SemanticTokenTypes.keyword]:7,[Ne.SemanticTokenTypes.macro]:8,[Ne.SemanticTokenTypes.method]:9,[Ne.SemanticTokenTypes.modifier]:10,[Ne.SemanticTokenTypes.namespace]:11,[Ne.SemanticTokenTypes.number]:12,[Ne.SemanticTokenTypes.operator]:13,[Ne.SemanticTokenTypes.parameter]:14,[Ne.SemanticTokenTypes.property]:15,[Ne.SemanticTokenTypes.regexp]:16,[Ne.SemanticTokenTypes.string]:17,[Ne.SemanticTokenTypes.struct]:18,[Ne.SemanticTokenTypes.type]:19,[Ne.SemanticTokenTypes.typeParameter]:20,[Ne.SemanticTokenTypes.variable]:21,[Ne.SemanticTokenTypes.decorator]:22},UW={[Ne.SemanticTokenModifiers.abstract]:1,[Ne.SemanticTokenModifiers.async]:2,[Ne.SemanticTokenModifiers.declaration]:4,[Ne.SemanticTokenModifiers.defaultLibrary]:8,[Ne.SemanticTokenModifiers.definition]:16,[Ne.SemanticTokenModifiers.deprecated]:32,[Ne.SemanticTokenModifiers.documentation]:64,[Ne.SemanticTokenModifiers.modification]:128,[Ne.SemanticTokenModifiers.readonly]:256,[Ne.SemanticTokenModifiers.static]:512},hC={legend:{tokenTypes:Object.keys(mC),tokenModifiers:Object.keys(UW)},full:{delta:!0},range:!0};var pC;(function(t){function e(n,i){let o=new Map;Object.entries(mC).forEach(([l,u])=>o.set(u,l));let s=0,a=0;return r(n.data,5).map(l=>{s+=l[0],l[0]!==0&&(a=0),a+=l[1];let u=l[2];return{offset:i.textDocument.offsetAt({line:s,character:a}),tokenType:o.get(l[3]),tokenModifiers:l[4],text:i.textDocument.getText({start:{line:s,character:a},end:{line:s,character:a+u}})}})}t.decode=e;function r(n,i){let o=[];for(let s=0;s<n.length;s+=i){let a=n.slice(s,s+i);o.push(a)}return o}})(pC||(pC={}));var gp=class{provideSignatureHelp(e,r,n=re.CancellationToken.None){let o=e.parseResult.value.$cstNode;if(o){let s=El(o,e.textDocument.offsetAt(r.position));if(s)return this.getSignatureFromElement(s.astNode,n)}}get signatureHelpOptions(){return{triggerCharacters:["("],retriggerCharacters:[","]}}};function gC(t){let e=[],r=[];t.forEach(i=>{i!=null&&i.triggerCharacters&&e.push(...i.triggerCharacters),i!=null&&i.retriggerCharacters&&r.push(...i.retriggerCharacters)});let n={triggerCharacters:e.length>0?Array.from(new Set(e)).sort():void 0,retriggerCharacters:r.length>0?Array.from(new Set(r)).sort():void 0};return n.triggerCharacters?n:void 0}var Tp=class{constructor(e){this.onInitializeEmitter=new gn.Emitter,this.onInitializedEmitter=new gn.Emitter,this.services=e}get onInitialize(){return this.onInitializeEmitter.event}get onInitialized(){return this.onInitializedEmitter.event}async initialize(e){return this.eagerLoadServices(),this.fireInitializeOnDefaultServices(e),this.onInitializeEmitter.fire(e),this.onInitializeEmitter.dispose(),this.buildInitializeResult(e)}eagerLoadServices(){$u(this.services),this.services.ServiceRegistry.all.forEach(e=>$u(e))}hasService(e){return this.services.ServiceRegistry.all.some(n=>e(n)!==void 0)}buildInitializeResult(e){var r,n,i,o;let s=(r=this.services.lsp.FileOperationHandler)===null||r===void 0?void 0:r.fileOperationOptions,a=this.services.ServiceRegistry.all,l=this.hasService($=>{var w;return(w=$.lsp)===null||w===void 0?void 0:w.Formatter}),u=a.map($=>{var w,le;return(le=(w=$.lsp)===null||w===void 0?void 0:w.Formatter)===null||le===void 0?void 0:le.formatOnTypeOptions}).find($=>!!$),c=this.hasService($=>{var w;return(w=$.lsp)===null||w===void 0?void 0:w.CodeActionProvider}),f=this.hasService($=>{var w;return(w=$.lsp)===null||w===void 0?void 0:w.SemanticTokenProvider}),d=(i=(n=this.services.lsp)===null||n===void 0?void 0:n.ExecuteCommandHandler)===null||i===void 0?void 0:i.commands,m=this.hasService($=>{var w;return(w=$.lsp)===null||w===void 0?void 0:w.DocumentLinkProvider}),_=gC(a.map($=>{var w,le;return(le=(w=$.lsp)===null||w===void 0?void 0:w.SignatureHelp)===null||le===void 0?void 0:le.signatureHelpOptions})),x=this.hasService($=>{var w;return(w=$.lsp)===null||w===void 0?void 0:w.TypeProvider}),A=this.hasService($=>{var w;return(w=$.lsp)===null||w===void 0?void 0:w.ImplementationProvider}),I=this.hasService($=>{var w;return(w=$.lsp)===null||w===void 0?void 0:w.CompletionProvider}),y=hE(a.map($=>{var w,le;return(le=(w=$.lsp)===null||w===void 0?void 0:w.CompletionProvider)===null||le===void 0?void 0:le.completionOptions})),g=this.hasService($=>{var w;return(w=$.lsp)===null||w===void 0?void 0:w.ReferencesProvider}),O=this.hasService($=>{var w;return(w=$.lsp)===null||w===void 0?void 0:w.DocumentSymbolProvider}),M=this.hasService($=>{var w;return(w=$.lsp)===null||w===void 0?void 0:w.DefinitionProvider}),J=this.hasService($=>{var w;return(w=$.lsp)===null||w===void 0?void 0:w.DocumentHighlightProvider}),ce=this.hasService($=>{var w;return(w=$.lsp)===null||w===void 0?void 0:w.FoldingRangeProvider}),_e=this.hasService($=>{var w;return(w=$.lsp)===null||w===void 0?void 0:w.HoverProvider}),je=this.hasService($=>{var w;return(w=$.lsp)===null||w===void 0?void 0:w.RenameProvider}),Ce=this.hasService($=>{var w;return(w=$.lsp)===null||w===void 0?void 0:w.CallHierarchyProvider}),j=this.hasService($=>{var w;return(w=$.lsp)===null||w===void 0?void 0:w.TypeHierarchyProvider}),k=this.hasService($=>{var w;return(w=$.lsp)===null||w===void 0?void 0:w.CodeLensProvider}),V=this.hasService($=>{var w;return(w=$.lsp)===null||w===void 0?void 0:w.DeclarationProvider}),G=this.hasService($=>{var w;return(w=$.lsp)===null||w===void 0?void 0:w.InlayHintProvider}),ie=(o=this.services.lsp)===null||o===void 0?void 0:o.WorkspaceSymbolProvider;return{capabilities:{workspace:{workspaceFolders:{supported:!0},fileOperations:s},executeCommandProvider:d&&{commands:d},textDocumentSync:gn.TextDocumentSyncKind.Incremental,completionProvider:I?y:void 0,referencesProvider:g,documentSymbolProvider:O,definitionProvider:M,typeDefinitionProvider:x,documentHighlightProvider:J,codeActionProvider:c,documentFormattingProvider:l,documentRangeFormattingProvider:l,documentOnTypeFormattingProvider:u,foldingRangeProvider:ce,hoverProvider:_e,renameProvider:je?{prepareProvider:!0}:void 0,semanticTokensProvider:f?hC:void 0,signatureHelpProvider:_,implementationProvider:A,callHierarchyProvider:Ce?{}:void 0,typeHierarchyProvider:j?{}:void 0,documentLinkProvider:m?{resolveProvider:!1}:void 0,codeLensProvider:k?{resolveProvider:!1}:void 0,declarationProvider:V,inlayHintProvider:G?{resolveProvider:!1}:void 0,workspaceSymbolProvider:ie?{resolveProvider:!!ie.resolveSymbol}:void 0}}}initialized(e){this.fireInitializedOnDefaultServices(e),this.onInitializedEmitter.fire(e),this.onInitializedEmitter.dispose()}fireInitializeOnDefaultServices(e){this.services.workspace.ConfigurationProvider.initialize(e),this.services.workspace.WorkspaceManager.initialize(e)}fireInitializedOnDefaultServices(e){let r=this.services.lsp.Connection,n=r?Object.assign(Object.assign({},e),{register:i=>r.client.register(gn.DidChangeConfigurationNotification.type,i),fetchConfiguration:i=>r.workspace.getConfiguration(i)}):e;this.services.workspace.ConfigurationProvider.initialized(n).catch(i=>console.error("Error in ConfigurationProvider initialization:",i)),this.services.workspace.WorkspaceManager.initialized(e).catch(i=>console.error("Error in WorkspaceManager initialization:",i))}};function TC(t){let e=t.lsp.Connection;if(!e)throw new Error("Starting a language server requires the languageServer.Connection service to be set.");VW(e,t),BW(e,t),WW(e,t),GW(e,t),jW(e,t),HW(e,t),KW(e,t),zW(e,t),YW(e,t),JW(e,t),ZW(e,t),eG(e,t),qW(e,t),tG(e,t),QW(e,t),rG(e,t),nG(e,t),oG(e,t),aG(e,t),cG(e,t),fG(e,t),lG(e,t),sG(e,t),iG(e,t),XW(e,t),uG(e,t),e.onInitialize(n=>t.lsp.LanguageServer.initialize(n)),e.onInitialized(n=>{t.lsp.LanguageServer.initialized(n)}),t.workspace.TextDocuments.listen(e),e.listen()}function VW(t,e){let r=e.lsp.DocumentUpdateHandler;e.workspace.TextDocuments.onDidChangeContent(i=>r.didChangeContent(i)),t.onDidChangeWatchedFiles(i=>r.didChangeWatchedFiles(i))}function BW(t,e){let r=e.lsp.FileOperationHandler;r&&(r.didCreateFiles&&t.workspace.onDidCreateFiles(n=>r.didCreateFiles(n)),r.didRenameFiles&&t.workspace.onDidRenameFiles(n=>r.didRenameFiles(n)),r.didDeleteFiles&&t.workspace.onDidDeleteFiles(n=>r.didDeleteFiles(n)),r.willCreateFiles&&t.workspace.onWillCreateFiles(n=>r.willCreateFiles(n)),r.willRenameFiles&&t.workspace.onWillRenameFiles(n=>r.willRenameFiles(n)),r.willDeleteFiles&&t.workspace.onWillDeleteFiles(n=>r.willDeleteFiles(n)))}function WW(t,e){e.workspace.DocumentBuilder.onBuildPhase(ae.Validated,async(n,i)=>{for(let o of n)if(o.diagnostics&&t.sendDiagnostics({uri:o.uri.toString(),diagnostics:o.diagnostics}),i.isCancellationRequested)return})}function GW(t,e){t.onCompletion(Er((r,n,i,o)=>{var s,a;return(a=(s=r.lsp)===null||s===void 0?void 0:s.CompletionProvider)===null||a===void 0?void 0:a.getCompletion(n,i,o)},e,ae.IndexedReferences))}function jW(t,e){t.onReferences(Er((r,n,i,o)=>{var s,a;return(a=(s=r.lsp)===null||s===void 0?void 0:s.ReferencesProvider)===null||a===void 0?void 0:a.findReferences(n,i,o)},e,ae.IndexedReferences))}function qW(t,e){t.onCodeAction(Er((r,n,i,o)=>{var s,a;return(a=(s=r.lsp)===null||s===void 0?void 0:s.CodeActionProvider)===null||a===void 0?void 0:a.getCodeActions(n,i,o)},e,ae.Validated))}function HW(t,e){t.onDocumentSymbol(Er((r,n,i,o)=>{var s,a;return(a=(s=r.lsp)===null||s===void 0?void 0:s.DocumentSymbolProvider)===null||a===void 0?void 0:a.getSymbols(n,i,o)},e,ae.Parsed))}function KW(t,e){t.onDefinition(Er((r,n,i,o)=>{var s,a;return(a=(s=r.lsp)===null||s===void 0?void 0:s.DefinitionProvider)===null||a===void 0?void 0:a.getDefinition(n,i,o)},e,ae.IndexedReferences))}function zW(t,e){t.onTypeDefinition(Er((r,n,i,o)=>{var s,a;return(a=(s=r.lsp)===null||s===void 0?void 0:s.TypeProvider)===null||a===void 0?void 0:a.getTypeDefinition(n,i,o)},e,ae.IndexedReferences))}function YW(t,e){t.onImplementation(Er((r,n,i,o)=>{var s,a;return(a=(s=r.lsp)===null||s===void 0?void 0:s.ImplementationProvider)===null||a===void 0?void 0:a.getImplementation(n,i,o)},e,ae.IndexedReferences))}function XW(t,e){t.onDeclaration(Er((r,n,i,o)=>{var s,a;return(a=(s=r.lsp)===null||s===void 0?void 0:s.DeclarationProvider)===null||a===void 0?void 0:a.getDeclaration(n,i,o)},e,ae.IndexedReferences))}function JW(t,e){t.onDocumentHighlight(Er((r,n,i,o)=>{var s,a;return(a=(s=r.lsp)===null||s===void 0?void 0:s.DocumentHighlightProvider)===null||a===void 0?void 0:a.getDocumentHighlight(n,i,o)},e,ae.IndexedReferences))}function QW(t,e){t.onHover(Er((r,n,i,o)=>{var s,a;return(a=(s=r.lsp)===null||s===void 0?void 0:s.HoverProvider)===null||a===void 0?void 0:a.getHoverContent(n,i,o)},e,ae.IndexedReferences))}function ZW(t,e){t.onFoldingRanges(Er((r,n,i,o)=>{var s,a;return(a=(s=r.lsp)===null||s===void 0?void 0:s.FoldingRangeProvider)===null||a===void 0?void 0:a.getFoldingRanges(n,i,o)},e,ae.Parsed))}function eG(t,e){t.onDocumentFormatting(Er((r,n,i,o)=>{var s,a;return(a=(s=r.lsp)===null||s===void 0?void 0:s.Formatter)===null||a===void 0?void 0:a.formatDocument(n,i,o)},e,ae.Parsed)),t.onDocumentRangeFormatting(Er((r,n,i,o)=>{var s,a;return(a=(s=r.lsp)===null||s===void 0?void 0:s.Formatter)===null||a===void 0?void 0:a.formatDocumentRange(n,i,o)},e,ae.Parsed)),t.onDocumentOnTypeFormatting(Er((r,n,i,o)=>{var s,a;return(a=(s=r.lsp)===null||s===void 0?void 0:s.Formatter)===null||a===void 0?void 0:a.formatDocumentOnType(n,i,o)},e,ae.Parsed))}function tG(t,e){t.onRenameRequest(Er((r,n,i,o)=>{var s,a;return(a=(s=r.lsp)===null||s===void 0?void 0:s.RenameProvider)===null||a===void 0?void 0:a.rename(n,i,o)},e,ae.IndexedReferences)),t.onPrepareRename(Er((r,n,i,o)=>{var s,a;return(a=(s=r.lsp)===null||s===void 0?void 0:s.RenameProvider)===null||a===void 0?void 0:a.prepareRename(n,i,o)},e,ae.IndexedReferences))}function rG(t,e){t.languages.inlayHint.on(Ri((r,n,i,o)=>{var s,a;return(a=(s=r.lsp)===null||s===void 0?void 0:s.InlayHintProvider)===null||a===void 0?void 0:a.getInlayHints(n,i,o)},e,ae.IndexedReferences))}function nG(t,e){let r={data:[]};t.languages.semanticTokens.on(Ri((n,i,o,s)=>{var a;return!((a=n.lsp)===null||a===void 0)&&a.SemanticTokenProvider?n.lsp.SemanticTokenProvider.semanticHighlight(i,o,s):r},e,ae.IndexedReferences)),t.languages.semanticTokens.onDelta(Ri((n,i,o,s)=>{var a;return!((a=n.lsp)===null||a===void 0)&&a.SemanticTokenProvider?n.lsp.SemanticTokenProvider.semanticHighlightDelta(i,o,s):r},e,ae.IndexedReferences)),t.languages.semanticTokens.onRange(Ri((n,i,o,s)=>{var a;return!((a=n.lsp)===null||a===void 0)&&a.SemanticTokenProvider?n.lsp.SemanticTokenProvider.semanticHighlightRange(i,o,s):r},e,ae.IndexedReferences))}function iG(t,e){t.onDidChangeConfiguration(r=>{r.settings&&e.workspace.ConfigurationProvider.updateConfiguration(r)})}function oG(t,e){let r=e.lsp.ExecuteCommandHandler;r&&t.onExecuteCommand(async(n,i)=>{var o;try{return await r.executeCommand(n.command,(o=n.arguments)!==null&&o!==void 0?o:[],i)}catch(s){return us(s)}})}function sG(t,e){t.onDocumentLinks(Ri((r,n,i,o)=>{var s,a;return(a=(s=r.lsp)===null||s===void 0?void 0:s.DocumentLinkProvider)===null||a===void 0?void 0:a.getDocumentLinks(n,i,o)},e,ae.Parsed))}function aG(t,e){t.onSignatureHelp(Ri((r,n,i,o)=>{var s,a;return(a=(s=r.lsp)===null||s===void 0?void 0:s.SignatureHelp)===null||a===void 0?void 0:a.provideSignatureHelp(n,i,o)},e,ae.IndexedReferences))}function lG(t,e){t.onCodeLens(Ri((r,n,i,o)=>{var s,a;return(a=(s=r.lsp)===null||s===void 0?void 0:s.CodeLensProvider)===null||a===void 0?void 0:a.provideCodeLens(n,i,o)},e,ae.IndexedReferences))}function uG(t,e){var r;let n=e.lsp.WorkspaceSymbolProvider;if(n){let i=e.workspace.DocumentBuilder;t.onWorkspaceSymbol(async(s,a)=>{try{return await i.waitUntil(ae.IndexedContent,a),await n.getSymbols(s,a)}catch(l){return us(l)}});let o=(r=n.resolveSymbol)===null||r===void 0?void 0:r.bind(n);o&&t.onWorkspaceSymbolResolve(async(s,a)=>{try{return await i.waitUntil(ae.IndexedContent,a),await o(s,a)}catch(l){return us(l)}})}}function cG(t,e){t.languages.callHierarchy.onPrepare(Ri(async(r,n,i,o)=>{var s;if(!((s=r.lsp)===null||s===void 0)&&s.CallHierarchyProvider){let a=await r.lsp.CallHierarchyProvider.prepareCallHierarchy(n,i,o);return a!=null?a:null}return null},e,ae.IndexedReferences)),t.languages.callHierarchy.onIncomingCalls(yp(async(r,n,i)=>{var o;if(!((o=r.lsp)===null||o===void 0)&&o.CallHierarchyProvider){let s=await r.lsp.CallHierarchyProvider.incomingCalls(n,i);return s!=null?s:null}return null},e)),t.languages.callHierarchy.onOutgoingCalls(yp(async(r,n,i)=>{var o;if(!((o=r.lsp)===null||o===void 0)&&o.CallHierarchyProvider){let s=await r.lsp.CallHierarchyProvider.outgoingCalls(n,i);return s!=null?s:null}return null},e))}function fG(t,e){e.ServiceRegistry.all.some(r=>{var n;return(n=r.lsp)===null||n===void 0?void 0:n.TypeHierarchyProvider})&&(t.languages.typeHierarchy.onPrepare(Ri(async(r,n,i,o)=>{var s,a;let l=await((a=(s=r.lsp)===null||s===void 0?void 0:s.TypeHierarchyProvider)===null||a===void 0?void 0:a.prepareTypeHierarchy(n,i,o));return l!=null?l:null},e,ae.IndexedReferences)),t.languages.typeHierarchy.onSupertypes(yp(async(r,n,i)=>{var o,s;let a=await((s=(o=r.lsp)===null||o===void 0?void 0:o.TypeHierarchyProvider)===null||s===void 0?void 0:s.supertypes(n,i));return a!=null?a:null},e)),t.languages.typeHierarchy.onSubtypes(yp(async(r,n,i)=>{var o,s;let a=await((s=(o=r.lsp)===null||o===void 0?void 0:o.TypeHierarchyProvider)===null||s===void 0?void 0:s.subtypes(n,i));return a!=null?a:null},e)))}function yp(t,e){let r=e.ServiceRegistry;return async(n,i)=>{let o=Pe.parse(n.item.uri),s=await Qy(e,i,o,ae.IndexedReferences);if(s)return s;let a=r.getServices(o);if(!a){let l=`Could not find service instance for uri: '${o.toString()}'`;throw console.error(l),new Error(l)}try{return await t(a,n,i)}catch(l){return us(l)}}}function Ri(t,e,r){let n=e.workspace.LangiumDocuments,i=e.ServiceRegistry;return async(o,s)=>{let a=Pe.parse(o.textDocument.uri),l=await Qy(e,s,a,r);if(l)return l;let u=i.getServices(a);if(!u){let f=`Could not find service instance for uri: '${a}'`;throw console.error(f),new Error(f)}let c=await n.getOrCreateDocument(a);try{return await t(u,c,o,s)}catch(f){return us(f)}}}function Er(t,e,r){let n=e.workspace.LangiumDocuments,i=e.ServiceRegistry;return async(o,s)=>{let a=Pe.parse(o.textDocument.uri),l=await Qy(e,s,a,r);if(l)return l;let u=i.getServices(a);if(!u)return console.error(`Could not find service instance for uri: '${a.toString()}'`),null;let c=n.getDocument(a);if(!c)return null;try{return await t(u,c,o,s)}catch(f){return us(f)}}}async function Qy(t,e,r,n){if(n!==void 0){let i=t.workspace.DocumentBuilder;try{await i.waitUntil(n,r,e)}catch(o){return us(o)}}}function us(t){if(Zn(t))return new gn.ResponseError(gn.LSPErrorCodes.RequestCancelled,"The request has been cancelled.");if(t instanceof gn.ResponseError)return t;throw t}var vp=yt(Or(),1),_p=class{getSymbolKind(){return vp.SymbolKind.Field}getCompletionItemKind(){return vp.CompletionItemKind.Reference}};var yC=yt(Or(),1);var Rp=class{constructor(e){this.nameProvider=e.references.NameProvider,this.references=e.references.References,this.grammarConfig=e.parser.GrammarConfig}findReferences(e,r){let n=e.parseResult.value.$cstNode;if(!n)return[];let i=rr(n,e.textDocument.offsetAt(r.position),this.grammarConfig.nameRegexp);return i?this.getReferences(i,r,e):[]}getReferences(e,r,n){let i=[],o=this.references.findDeclaration(e);if(o){let s={includeDeclaration:r.context.includeDeclaration};this.references.findReferences(o,s).forEach(a=>{i.push(yC.Location.create(a.sourceUri.toString(),a.segment.range))})}return i}};var xp=class{constructor(e){this.references=e.references.References,this.nameProvider=e.references.NameProvider,this.grammarConfig=e.parser.GrammarConfig}async rename(e,r){let n={},i=e.parseResult.value.$cstNode;if(!i)return;let o=e.textDocument.offsetAt(r.position),s=rr(i,o,this.grammarConfig.nameRegexp);if(!s)return;let a=this.references.findDeclaration(s);if(!a)return;let l={onlyLocal:!1,includeDeclaration:!0};return this.references.findReferences(a,l).forEach(c=>{let f=uo.replace(c.segment.range,r.newName),d=c.sourceUri.toString();n[d]?n[d].push(f):n[d]=[f]}),{changes:n}}prepareRename(e,r){return this.renameNodeRange(e,r.position)}renameNodeRange(e,r){let n=e.parseResult.value.$cstNode,i=e.textDocument.offsetAt(r);if(n&&i){let o=rr(n,i,this.grammarConfig.nameRegexp);if(!o)return;if(this.references.findDeclaration(o)||this.isNameNode(o))return o.range}}isNameNode(e){return(e==null?void 0:e.astNode)&&rp(e.astNode)&&e===this.nameProvider.getNameNode(e.astNode)}};var Np=class{constructor(e){this.indexManager=e.workspace.IndexManager,this.nodeKindProvider=e.lsp.NodeKindProvider,this.fuzzyMatcher=e.lsp.FuzzyMatcher}async getSymbols(e,r=re.CancellationToken.None){let n=[],i=e.query.toLowerCase();for(let o of this.indexManager.allElements())if(await Ot(r),this.fuzzyMatcher.match(i,o.name)){let s=this.getWorkspaceSymbol(o);s&&n.push(s)}return n}getWorkspaceSymbol(e){let r=e.nameSegment;if(r)return{kind:this.nodeKindProvider.getSymbolKind(e),name:e.name,location:{range:r.range,uri:e.documentUri.toString()}}}};function vC(t){return za.merge(ku(t),dG(t))}function dG(t){return{lsp:{CompletionProvider:e=>new Xs(e),DocumentSymbolProvider:e=>new fp(e),HoverProvider:e=>new hp(e),FoldingRangeProvider:e=>new pp(e),ReferencesProvider:e=>new Rp(e),DefinitionProvider:e=>new Df(e),DocumentHighlightProvider:e=>new Ya(e),RenameProvider:e=>new xp(e)},shared:()=>t.shared}}function RC(t){return za.merge(wu(t),pG(t))}function pG(t){return{lsp:{Connection:()=>t.connection,LanguageServer:e=>new Tp(e),DocumentUpdateHandler:e=>new dp(e),WorkspaceSymbolProvider:e=>new Np(e),NodeKindProvider:()=>new _p,FuzzyMatcher:()=>new mp},workspace:{TextDocuments:()=>new _C.TextDocuments(co)}}}var Ep=class{constructor(){this.collector=()=>{}}getNodeFormatter(e){return new Zy(e,this.collector)}formatDocument(e,r){let n=e.parseResult;return n.lexerErrors.length===0&&n.parserErrors.length===0?this.doDocumentFormat(e,r.options):[]}isFormatRangeErrorFree(e,r){let n=e.parseResult;return n.lexerErrors.length||n.parserErrors.length?Math.min(...n.lexerErrors.map(o=>{var s;return(s=o.line)!==null&&s!==void 0?s:Number.MAX_VALUE}),...n.parserErrors.map(o=>{var s;return(s=o.token.startLine)!==null&&s!==void 0?s:Number.MAX_VALUE}))>r.end.line:!0}formatDocumentRange(e,r){return this.isFormatRangeErrorFree(e,r.range)?this.doDocumentFormat(e,r.options,r.range):[]}formatDocumentOnType(e,r){let n={start:{character:0,line:r.position.line},end:r.position};return this.isFormatRangeErrorFree(e,n)?this.doDocumentFormat(e,r.options,n):[]}get formatOnTypeOptions(){}doDocumentFormat(e,r,n){let i=new Map,o=(a,l,u)=>{var c,f;let d=this.nodeModeToKey(a,l),m=i.get(d),_=(c=u.options.priority)!==null&&c!==void 0?c:0,x=(f=m==null?void 0:m.options.priority)!==null&&f!==void 0?f:0;(!m||x<=_)&&i.set(d,u)};this.collector=o,this.iterateAstFormatting(e,n);let s=this.iterateCstFormatting(e,i,r,n);return this.avoidOverlappingEdits(e.textDocument,s)}avoidOverlappingEdits(e,r){let n=[];for(let i of r){let o=n[n.length-1];if(o){let s=e.offsetAt(i.range.start),a=e.offsetAt(o.range.end);s<a&&n.pop()}n.push(i)}return n}iterateAstFormatting(e,r){let n=e.parseResult.value;this.format(n);let i=jr(n).iterator(),o;do if(o=i.next(),!o.done){let s=o.value;this.insideRange(s.$cstNode.range,r)?this.format(s):i.prune()}while(!o.done)}nodeModeToKey(e,r){return`${e.offset}:${e.end}:${r}`}insideRange(e,r){return!r||e.start.line<=r.start.line&&e.end.line>=r.end.line||e.start.line>=r.start.line&&e.end.line<=r.end.line||e.start.line<=r.end.line&&e.end.line>=r.end.line}isNecessary(e,r){return r.getText(e.range)!==e.newText}iterateCstFormatting(e,r,n,i){let o={indentation:0,options:n,document:e.textDocument},s=[],l=this.iterateCstTree(e,o).iterator(),u,c;do if(c=l.next(),!c.done){let f=c.value,d=En(f),m=this.nodeModeToKey(f,"prepend"),_=r.get(m);if(r.delete(m),_){let I=this.createTextEdit(u,f,_,o);for(let y of I)y&&this.insideRange(y.range,i)&&this.isNecessary(y,e.textDocument)&&s.push(y)}let x=this.nodeModeToKey(f,"append"),A=r.get(x);if(r.delete(x),A){let I=rT(f);if(I){let y=this.createTextEdit(f,I,A,o);for(let g of y)g&&this.insideRange(g.range,i)&&this.isNecessary(g,e.textDocument)&&s.push(g)}}if(!_&&f.hidden){let I=this.createHiddenTextEdits(u,f,void 0,o);for(let y of I)y&&this.insideRange(y.range,i)&&this.isNecessary(y,e.textDocument)&&s.push(y)}d&&(u=f)}while(!c.done);return s}createHiddenTextEdits(e,r,n,i){var o;let s=r.range.start.line;if(e&&e.range.end.line===s)return[];let a=[],l={start:{character:0,line:s},end:r.range.start},u=i.document.getText(l),c=this.findFittingMove(l,(o=n==null?void 0:n.moves)!==null&&o!==void 0?o:[],i),f=this.getExistingIndentationCharacterCount(u,i),m=this.getIndentationCharacterCount(i,c)-f;if(m===0)return[];let _="";m>0&&(_=(i.options.insertSpaces?" ":"	").repeat(m));let x=r.text.split(`
`);x[0]=u+x[0];for(let A=0;A<x.length;A++){let I=s+A,y={character:0,line:I};if(m>0)a.push({newText:_,range:{start:y,end:y}});else{let g=x[A],O=0;for(;O<g.length;O++){let M=g.charAt(O);if(M!==" "&&M!=="	")break}a.push({newText:"",range:{start:y,end:{line:I,character:Math.min(O,Math.abs(m))}}})}}return a}getExistingIndentationCharacterCount(e,r){let n=" ".repeat(r.options.tabSize);return(r.options.insertSpaces?e.replaceAll("	",n):e.replaceAll(n,"	")).length}getIndentationCharacterCount(e,r){let n=e.indentation;return r&&r.tabs&&(n+=r.tabs),(e.options.insertSpaces?e.options.tabSize:1)*n}createTextEdit(e,r,n,i){var o;if(r.hidden)return this.createHiddenTextEdits(e,r,n,i);let s={start:(o=e==null?void 0:e.range.end)!==null&&o!==void 0?o:{character:0,line:0},end:r.range.start},a=this.findFittingMove(s,n.moves,i);if(!a)return[];let l=a.characters,u=a.lines,c=a.tabs,f=i.indentation;i.indentation+=c!=null?c:0;let d=[];return l!==void 0?d.push(this.createSpaceTextEdit(s,l,n.options)):u!==void 0?d.push(this.createLineTextEdit(s,u,i,n.options)):c!==void 0&&d.push(this.createTabTextEdit(s,!!e,i)),En(r)&&(i.indentation=f),d}createSpaceTextEdit(e,r,n){if(e.start.line===e.end.line){let o=e.end.character-e.start.character;r=this.fitIntoOptions(r,o,n)}return{newText:" ".repeat(r),range:e}}createLineTextEdit(e,r,n,i){let o=e.end.line-e.start.line;r=this.fitIntoOptions(r,o,i);let a=(n.options.insertSpaces?" ".repeat(n.options.tabSize):"	").repeat(n.indentation);return{newText:`${`
`.repeat(r)}${a}`,range:e}}createTabTextEdit(e,r,n){let o=(n.options.insertSpaces?" ".repeat(n.options.tabSize):"	").repeat(n.indentation),s=r?1:0,a=Math.max(e.end.line-e.start.line,s);return{newText:`${`
`.repeat(a)}${o}`,range:e}}fitIntoOptions(e,r,n){return n.allowMore?e=Math.max(r,e):n.allowLess&&(e=Math.min(r,e)),e}findFittingMove(e,r,n){if(r.length===0)return;if(r.length===1)return r[0];let i=e.end.line-e.start.line;for(let o of r){if(o.lines!==void 0&&i<=o.lines)return o;if(o.lines===void 0&&i===0)return o}return r[r.length-1]}iterateCstTree(e,r){let i=e.parseResult.value.$cstNode;return i?new dn(i,o=>this.iterateCst(o,r)):Bi}iterateCst(e,r){if(!Ar(e))return Bi;let n=r.indentation;return new Sr(()=>({index:0}),i=>i.index<e.content.length?{done:!1,value:e.content[i.index++]}:(r.indentation=n,cr))}},Zy=class{constructor(e,r){this.astNode=e,this.collector=r}node(e){return new Dn(e.$cstNode?[e.$cstNode]:[],this.collector)}nodes(...e){let r=[];for(let n of e)n.$cstNode&&r.push(n.$cstNode);return new Dn(r,this.collector)}property(e,r){let n=ji(this.astNode.$cstNode,e,r);return new Dn(n?[n]:[],this.collector)}properties(...e){let r=[];for(let n of e){let i=Hs(this.astNode.$cstNode,n);r.push(...i)}return new Dn(r,this.collector)}keyword(e,r){let n=Ks(this.astNode.$cstNode,e,r);return new Dn(n?[n]:[],this.collector)}keywords(...e){let r=[];for(let n of e){let i=Of(this.astNode.$cstNode,n);r.push(...i)}return new Dn(r,this.collector)}cst(e){return new Dn([...e],this.collector)}interior(e,r){let n=e.nodes,i=r.nodes;if(n.length!==1||i.length!==1)return new Dn([],this.collector);let o=n[0],s=i[0];if(o.offset>s.offset){let a=o;o=s,s=a}return new Dn(nT(o,s),this.collector)}},Dn=class t{constructor(e,r){this.nodes=e,this.collector=r}prepend(e){for(let r of this.nodes)this.collector(r,"prepend",e);return this}append(e){for(let r of this.nodes)this.collector(r,"append",e);return this}surround(e){for(let r of this.nodes)this.collector(r,"prepend",e),this.collector(r,"append",e);return this}slice(e,r){return new t(this.nodes.slice(e,r),this.collector)}},xC;(function(t){function e(...c){return{options:{},moves:c.flatMap(f=>f.moves).sort(u)}}t.fit=e;function r(c){return i(0,c)}t.noSpace=r;function n(c){return i(1,c)}t.oneSpace=n;function i(c,f){return{options:f!=null?f:{},moves:[{characters:c}]}}t.spaces=i;function o(c){return s(1,c)}t.newLine=o;function s(c,f){return{options:f!=null?f:{},moves:[{lines:c}]}}t.newLines=s;function a(c){return{options:c!=null?c:{},moves:[{tabs:1,lines:1}]}}t.indent=a;function l(c){return{options:c!=null?c:{},moves:[{tabs:0}]}}t.noIndent=l;function u(c,f){var d,m,_,x,A,I;let y=(d=c.lines)!==null&&d!==void 0?d:0,g=(m=f.lines)!==null&&m!==void 0?m:0,O=(_=c.tabs)!==null&&_!==void 0?_:0,M=(x=f.tabs)!==null&&x!==void 0?x:0,J=(A=c.characters)!==null&&A!==void 0?A:0,ce=(I=f.characters)!==null&&I!==void 0?I:0;return y<g?-1:y>g?1:O<M?-1:O>M?1:J<ce?-1:J>ce?1:0}})(xC||(xC={}));var mG=yt(Or(),1);var e_=yt(require("fs"),1),t_=class{constructor(){this.encoding="utf-8"}readFile(e){return e_.promises.readFile(e.fsPath,this.encoding)}async readDirectory(e){return(await e_.promises.readdir(e.fsPath,{withFileTypes:!0})).map(n=>({dirent:n,isFile:n.isFile(),isDirectory:n.isDirectory(),uri:Vt.joinPath(e,n.name)}))}},NC={fileSystemProvider:()=>new t_};var rl=yt(IC(),1);var Aae=Symbol("LdLSPServices");var Me={};Ai(Me,{AbstractAstReflection:()=>Io,AbstractCstNode:()=>lu,AbstractLangiumParser:()=>uu,AbstractParserErrorMessageProvider:()=>Yd,AbstractThreadedAsyncParser:()=>lp,AstUtils:()=>Qt,BiMap:()=>Zo,Cancellation:()=>re,CompositeCstNodeImpl:()=>zo,ContextCache:()=>ts,CstNodeBuilder:()=>au,CstUtils:()=>Wi,DONE_RESULT:()=>cr,DatatypeSymbol:()=>zd,DefaultAstNodeDescriptionProvider:()=>_u,DefaultAstNodeLocator:()=>vu,DefaultAsyncParser:()=>Cu,DefaultCommentProvider:()=>Du,DefaultConfigurationProvider:()=>Ru,DefaultDocumentBuilder:()=>xu,DefaultDocumentValidator:()=>os,DefaultHydrator:()=>Lu,DefaultIndexManager:()=>Nu,DefaultJsonSerializer:()=>ns,DefaultLangiumDocumentFactory:()=>mu,DefaultLangiumDocuments:()=>hu,DefaultLexer:()=>Iu,DefaultLinker:()=>Xo,DefaultNameProvider:()=>Jo,DefaultReferenceDescriptionProvider:()=>ss,DefaultReferences:()=>Qo,DefaultScopeComputation:()=>es,DefaultScopeProvider:()=>rs,DefaultServiceRegistry:()=>is,DefaultTokenBuilder:()=>du,DefaultValueConverter:()=>pu,DefaultWorkspaceLock:()=>bu,DefaultWorkspaceManager:()=>Eu,Deferred:()=>wr,Disposable:()=>as,DisposableCache:()=>qa,DocumentCache:()=>np,DocumentState:()=>ae,DocumentValidator:()=>vi,EMPTY_SCOPE:()=>EW,EMPTY_STREAM:()=>Bi,EmptyFileSystem:()=>r_,EmptyFileSystemProvider:()=>Ip,ErrorWithLocation:()=>Co,GrammarAST:()=>st,GrammarUtils:()=>bt,JSDocDocumentationProvider:()=>Su,LangiumCompletionParser:()=>fu,LangiumParser:()=>cu,LangiumParserErrorMessageProvider:()=>Wa,LeafCstNodeImpl:()=>Ko,MapScope:()=>gu,Module:()=>za,MultiMap:()=>hn,OperationCancelled:()=>Qn,ParserWorker:()=>up,Reduction:()=>Ws,RegExpUtils:()=>If,RootCstNodeImpl:()=>Ba,SimpleCache:()=>Tu,StreamImpl:()=>Sr,StreamScope:()=>$r,TextDocument:()=>co,TreeStreamImpl:()=>dn,URI:()=>Pe,UriUtils:()=>Vt,ValidationCategory:()=>Ka,ValidationRegistry:()=>yu,ValueConverter:()=>Jn,WorkspaceCache:()=>Ha,assertUnreachable:()=>Gi,createCompletionParser:()=>Dy,createDefaultCoreModule:()=>ku,createDefaultSharedCoreModule:()=>wu,createGrammarConfig:()=>ET,createLangiumParser:()=>Cy,delayNextTick:()=>Vy,diagnosticData:()=>ip,eagerLoad:()=>$u,getDiagnosticRange:()=>QD,inject:()=>ls,interruptAndCheck:()=>Ot,isAstNode:()=>Be,isAstNodeDescription:()=>_l,isAstNodeWithComment:()=>Wy,isCompositeCstNode:()=>Ar,isIMultiModeLexerDefinition:()=>jy,isJSDoc:()=>zy,isLeafCstNode:()=>En,isLinkingError:()=>Nn,isNamed:()=>rp,isOperationCancelled:()=>Zn,isReference:()=>Rt,isRootCstNode:()=>vl,isTokenTypeArray:()=>ZD,isTokenTypeDictionary:()=>Gy,loadGrammarFromJson:()=>Op,parseJSDoc:()=>Ky,prepareLangiumParser:()=>VD,setInterruptionPeriod:()=>zD,startCancelableOperation:()=>KD,stream:()=>pe,toDiagnosticSeverity:()=>op});var we={};Ai(we,{AstUtils:()=>Qt,BiMap:()=>Zo,Cancellation:()=>re,ContextCache:()=>ts,CstUtils:()=>Wi,DONE_RESULT:()=>cr,Deferred:()=>wr,Disposable:()=>as,DisposableCache:()=>qa,DocumentCache:()=>np,EMPTY_STREAM:()=>Bi,ErrorWithLocation:()=>Co,GrammarUtils:()=>bt,MultiMap:()=>hn,OperationCancelled:()=>Qn,Reduction:()=>Ws,RegExpUtils:()=>If,SimpleCache:()=>Tu,StreamImpl:()=>Sr,TreeStreamImpl:()=>dn,URI:()=>Pe,UriUtils:()=>Vt,WorkspaceCache:()=>Ha,assertUnreachable:()=>Gi,delayNextTick:()=>Vy,interruptAndCheck:()=>Ot,isOperationCancelled:()=>Zn,loadGrammarFromJson:()=>Op,setInterruptionPeriod:()=>zD,startCancelableOperation:()=>KD,stream:()=>pe});De(we,wt);var Ip=class{readFile(){throw new Error("No file system is available.")}async readDirectory(){return[]}},r_={fileSystemProvider:()=>new Ip};var hG={Grammar:()=>{},LanguageMetaData:()=>({caseInsensitive:!1,fileExtensions:[".langium"],languageId:"langium"})},gG={AstReflection:()=>new Us};function TG(){let t=ls(wu(r_),gG),e=ls(ku({shared:t}),hG);return t.ServiceRegistry.register(e),e}function Op(t){var e;let r=TG(),n=r.serializer.JsonSerializer.deserialize(t);return r.shared.workspace.LangiumDocumentFactory.fromModel(n,Pe.parse(`memory://${(e=n.name)!==null&&e!==void 0?e:"grammar"}.langium`)),n}De(Me,we);var ho=yt(require("fs"),1),Ei=yt(require("path"),1),lt=yt(vt(),1);var n_="ComposeElement";var Sp="NamedElement";function OC(t){return Ye.isInstance(t,Sp)}var yG="Statement";var _G="Subscript_list";var i_="Universe";var Ap="VariableReferenceTarget";var AC="Alias";function Dp(t){return Ye.isInstance(t,AC)}var vG="Arr_string";function Xa(t){return Ye.isInstance(t,vG)}var RG="AssignPrefix";function Ja(t){return Ye.isInstance(t,RG)}var xG="Case_statement";function SC(t){return Ye.isInstance(t,xG)}var o_="Expression";function Cn(t){return Ye.isInstance(t,o_)}var NG="For_statement";function DC(t){return Ye.isInstance(t,NG)}var EG="Function_invoke_or_assign";function Cp(t){return Ye.isInstance(t,EG)}var IG="Function_invoke_or_assign_statement";var CC="FunctionBlock";function ei(t){return Ye.isInstance(t,CC)}var bC="GlobalVarList";function Uu(t){return Ye.isInstance(t,bC)}var OG="Interface";var AG="Invoke_subrule";function bp(t){return Ye.isInstance(t,AG)}var SG="Iteration_statement";var DG="Methods";function LC(t){return Ye.isInstance(t,DG)}var kC="Native_Type_Name";function Vu(t){return Ye.isInstance(t,kC)}var CG="Param_assignment";function wC(t){return Ye.isInstance(t,CG)}var bG="RefFunctionOrBlockName";function $C(t){return Ye.isInstance(t,bG)}var LG="Repeat_statement";function PC(t){return Ye.isInstance(t,LG)}var kG="ReturnParse";function MC(t){return Ye.isInstance(t,kG)}var wG="Selection_statement";var $G="StEnum";var FC="StFunction";function bn(t){return Ye.isInstance(t,FC)}var UC="Struct_Var_Decl_Init";function Bu(t){return Ye.isInstance(t,UC)}var VC="StructsList";function cs(t){return Ye.isInstance(t,VC)}var BC="VarDeclarationInit";function At(t){return Ye.isInstance(t,BC)}var PG="While_statement";function WC(t){return Ye.isInstance(t,PG)}var GC="Constant";function Qa(t){return Ye.isInstance(t,GC)}var jC="EnumeratedValue";function Tn(t){return Ye.isInstance(t,jC)}var qC="FunctionExpression";function fo(t){return Ye.isInstance(t,qC)}var HC="MemberCall";function Ln(t){return Ye.isInstance(t,HC)}var KC="VariableExpression";function Yt(t){return Ye.isInstance(t,KC)}var MG="Array_liters";var Fu=class extends Io{getAllTypes(){return["Action_call_statement","Alias","Arr_string","Array_element","Array_liters","AssignPrefix","Assignment_subrule","AttributePragma","Case_element","Case_list","Case_list_element","Case_statement","ComposeElement","Constant","Enum","EnumeratedValue","Expression","For_list","For_statement","FunctionBlock","FunctionExpression","Function_invoke_or_assign","Function_invoke_or_assign_statement","GlobalVarList","If_statement","InputsList","InputsListSingle","Interface","Invoke_subrule","Iteration_statement","MemberCall","Methods","NamedElement","Native_Type_Name","Param_assignment","PrimaryVariable","Program","RefFunctionOrBlockName","Repeat_statement","ReqParams","ReturnParse","Selection_statement","St","StEnum","StFunction","Statement","Statement_list","Statement_list_single","Struct_Var_Decl_Init","StructsList","Subscript_list","UnionsList","Universe","VarDeclarationInit","VarExternal","VarInput","VarLocal","VarOutput","VariableExpression","VariableReferenceTarget","While_statement"]}computeIsSubtype(e,r){switch(e){case AC:case CC:case $G:case VC:return this.isSubtype(n_,r);case MG:return this.isSubtype(kC,r);case GC:case jC:case qC:case HC:case KC:return this.isSubtype(o_,r);case o_:return this.isSubtype(_G,r);case IG:case SG:case wG:return this.isSubtype(yG,r);case bC:return this.isSubtype(Ap,r);case Sp:return this.isSubtype(i_,r)||this.isSubtype(Ap,r);case FC:return this.isSubtype(n_,r)||this.isSubtype(i_,r)||this.isSubtype(Ap,r);case UC:case BC:return this.isSubtype(Sp,r);default:return!1}}getReferenceType(e){let r=`${e.container.$type}:${e.property}`;switch(r){case"Action_call_statement:actionName":case"RefFunctionOrBlockName:refFunctionName":return i_;case"Array_liters:Identifier":case"EnumeratedValue:enumType":case"Native_Type_Name:Identifier":return n_;case"AssignPrefix:varEnchanceDecl":case"VariableExpression:variable":return Ap;case"For_statement:controlVariable":case"MemberCall:element":return Sp;case"Interface:extender":return OG;default:throw new Error(`${r} is not a valid reference id.`)}}getTypeMetaData(e){switch(e){case"Action_call_statement":return{name:"Action_call_statement",properties:[{name:"actionName"}]};case"Alias":return{name:"Alias",properties:[{name:"initialValue"},{name:"name"},{name:"refName"}]};case"Arr_string":return{name:"Arr_string",properties:[{name:"arrElements",defaultValue:[]}]};case"Array_element":return{name:"Array_element",properties:[{name:"left"},{name:"right"}]};case"Assignment_subrule":return{name:"Assignment_subrule",properties:[{name:"expression"}]};case"AssignPrefix":return{name:"AssignPrefix",properties:[{name:"varEnchanceDecl"}]};case"AttributePragma":return{name:"AttributePragma",properties:[{name:"attributeName"}]};case"Case_element":return{name:"Case_element",properties:[{name:"caseList"},{name:"statements"}]};case"Case_list":return{name:"Case_list",properties:[{name:"caseListElement",defaultValue:[]}]};case"Case_list_element":return{name:"Case_list_element",properties:[{name:"enumCase"},{name:"numCaseStart"},{name:"numericCaseEnd"},{name:"simpleEnumCase"}]};case"Case_statement":return{name:"Case_statement",properties:[{name:"caseElements",defaultValue:[]},{name:"caseExpression"},{name:"elseStatements"}]};case"Enum":return{name:"Enum",properties:[{name:"assignValue"},{name:"variable_name"}]};case"Expression":return{name:"Expression",properties:[{name:"left"},{name:"operator"},{name:"prior"},{name:"right"},{name:"value"}]};case"For_list":return{name:"For_list",properties:[{name:"byExpr"},{name:"forExpr"},{name:"toExpr"}]};case"For_statement":return{name:"For_statement",properties:[{name:"controlVariable"},{name:"forList"},{name:"statementList"}]};case"Function_invoke_or_assign":return{name:"Function_invoke_or_assign",properties:[{name:"assign"},{name:"assignPrefix"},{name:"id"},{name:"params",defaultValue:[]}]};case"Function_invoke_or_assign_statement":return{name:"Function_invoke_or_assign_statement",properties:[{name:"statement"}]};case"FunctionBlock":return{name:"FunctionBlock",properties:[{name:"methods",defaultValue:[]},{name:"name"},{name:"statementList",defaultValue:[]},{name:"varExternals",defaultValue:[]},{name:"varInputs",defaultValue:[]},{name:"varLocals",defaultValue:[]},{name:"varOutputs",defaultValue:[]}]};case"GlobalVarList":return{name:"GlobalVarList",properties:[{name:"attributes",defaultValue:[]},{name:"items",defaultValue:[]},{name:"modifiers",defaultValue:[]}]};case"If_statement":return{name:"If_statement",properties:[{name:"elseStatement"},{name:"elsifConditions",defaultValue:[]},{name:"elsifStatements"},{name:"ifCondition"},{name:"ifStatement"}]};case"InputsList":return{name:"InputsList",properties:[{name:"definition"},{name:"items",defaultValue:[]},{name:"modifiers"}]};case"InputsListSingle":return{name:"InputsListSingle",properties:[{name:"definition"},{name:"items",defaultValue:[]},{name:"modifiers"}]};case"Interface":return{name:"Interface",properties:[{name:"extender"},{name:"methods",defaultValue:[]},{name:"name"}]};case"Invoke_subrule":return{name:"Invoke_subrule",properties:[{name:"parameters",defaultValue:[]}]};case"Iteration_statement":return{name:"Iteration_statement",properties:[{name:"statement"}]};case"Methods":return{name:"Methods",properties:[{name:"inputs",defaultValue:[]},{name:"modifier"},{name:"name"},{name:"reqParams",defaultValue:[]},{name:"statementList"},{name:"variable_type"}]};case"Native_Type_Name":return{name:"Native_Type_Name",properties:[{name:"Any_type_name"},{name:"Bit_string_type_name"},{name:"Bool_type_name"},{name:"Cache_type_name"},{name:"Date_And_time_type_name"},{name:"Date_type_name"},{name:"Identifier"},{name:"Integer_type_name"},{name:"Real_type_name"},{name:"String_type_name"},{name:"Time_Of_Day_type_name"},{name:"Time_type_name"},{name:"Unsigned_integer_type_name"}]};case"Param_assignment":return{name:"Param_assignment",properties:[{name:"InputOrOutputSign"},{name:"ParamName"},{name:"ParamValue"}]};case"PrimaryVariable":return{name:"PrimaryVariable",properties:[{name:"name"}]};case"Program":return{name:"Program",properties:[{name:"inputs",defaultValue:[]},{name:"name"},{name:"stStatements"},{name:"varExternals",defaultValue:[]}]};case"RefFunctionOrBlockName":return{name:"RefFunctionOrBlockName",properties:[{name:"Cache_type_name"},{name:"refFunctionName"}]};case"Repeat_statement":return{name:"Repeat_statement",properties:[{name:"statementList"},{name:"untilExpr"}]};case"ReqParams":return{name:"ReqParams",properties:[{name:"param"},{name:"typeName"}]};case"ReturnParse":return{name:"ReturnParse",properties:[{name:"returnSign"},{name:"returnValue"}]};case"Selection_statement":return{name:"Selection_statement",properties:[{name:"case"},{name:"if"}]};case"St":return{name:"St",properties:[{name:"function_block",defaultValue:[]},{name:"globalVarLists",defaultValue:[]},{name:"itface",defaultValue:[]},{name:"program",defaultValue:[]},{name:"st_function",defaultValue:[]},{name:"types_alias",defaultValue:[]},{name:"types_enum",defaultValue:[]},{name:"types_struct",defaultValue:[]},{name:"types_union",defaultValue:[]}]};case"Statement_list":return{name:"Statement_list",properties:[{name:"statements",defaultValue:[]}]};case"Statement_list_single":return{name:"Statement_list_single",properties:[{name:"statements"}]};case"StEnum":return{name:"StEnum",properties:[{name:"enum",defaultValue:[]},{name:"name"}]};case"StFunction":return{name:"StFunction",properties:[{name:"name"},{name:"statementList",defaultValue:[]},{name:"variable_type"},{name:"varInputs",defaultValue:[]},{name:"varLocals",defaultValue:[]},{name:"varOutputs",defaultValue:[]}]};case"Struct_Var_Decl_Init":return{name:"Struct_Var_Decl_Init",properties:[{name:"initialValue"},{name:"nextVariables",defaultValue:[]},{name:"typeName"},{name:"variables"}]};case"StructsList":return{name:"StructsList",properties:[{name:"items",defaultValue:[]},{name:"name"}]};case"UnionsList":return{name:"UnionsList",properties:[{name:"items",defaultValue:[]},{name:"name"}]};case"VarDeclarationInit":return{name:"VarDeclarationInit",properties:[{name:"initialValue"},{name:"nextVariables",defaultValue:[]},{name:"typeName"},{name:"variables"}]};case"VarExternal":return{name:"VarExternal",properties:[{name:"items",defaultValue:[]}]};case"VarInput":return{name:"VarInput",properties:[{name:"items",defaultValue:[]}]};case"VarLocal":return{name:"VarLocal",properties:[{name:"items",defaultValue:[]}]};case"VarOutput":return{name:"VarOutput",properties:[{name:"items",defaultValue:[]}]};case"While_statement":return{name:"While_statement",properties:[{name:"statementList"},{name:"whileExpr"}]};case"Constant":return{name:"Constant",properties:[{name:"constant"},{name:"left"},{name:"operator"},{name:"prior"},{name:"right"},{name:"value"}]};case"EnumeratedValue":return{name:"EnumeratedValue",properties:[{name:"enumCacheTypeName"},{name:"enumType"},{name:"enumValue"},{name:"left"},{name:"operator"},{name:"prior"},{name:"right"},{name:"value"}]};case"FunctionExpression":return{name:"FunctionExpression",properties:[{name:"left"},{name:"operator"},{name:"params"},{name:"prior"},{name:"refFunctionName"},{name:"right"},{name:"value"}]};case"MemberCall":return{name:"MemberCall",properties:[{name:"arguments",defaultValue:[]},{name:"element"},{name:"explicitOperationCall",defaultValue:!1},{name:"left"},{name:"operator"},{name:"previous"},{name:"prior"},{name:"right"},{name:"value"}]};case"VariableExpression":return{name:"VariableExpression",properties:[{name:"left"},{name:"operator"},{name:"prior"},{name:"right"},{name:"value"},{name:"variable"}]};case"Array_liters":return{name:"Array_liters",properties:[{name:"Any_type_name"},{name:"arrayElemets",defaultValue:[]},{name:"Bit_string_type_name"},{name:"Bool_type_name"},{name:"Cache_type_name"},{name:"dataType"},{name:"Date_And_time_type_name"},{name:"Date_type_name"},{name:"Identifier"},{name:"Integer_type_name"},{name:"Real_type_name"},{name:"String_type_name"},{name:"Time_Of_Day_type_name"},{name:"Time_type_name"},{name:"Unsigned_integer_type_name"}]};default:return{name:e,properties:[]}}}},Ye=new Fu;var zC=yt(require("fs"),1);var Za=new Map,s_=new Map,el=new Map,pr=Pe.parse("memory://cache.st");function YC(t){if(s_.get(pr)){let e=s_.get(pr);if(e){let r=xi(e);for(let n=0;n<r.length;n++){let s=r[n].elements.find(a=>a.elementName.toLowerCase()===t.toLowerCase());if(s){let a=s.elementType;if(a==="functionBlock"||a==="function"||a==="struct"||a==="alias")return s;if(a==="enum")return s}}}}else{let e=__dirname,r=a_(`${e}\\data.json`),i=JSON.parse(r);s_.set(pr,i);let o=xi(i);for(let s=0;s<o.length;s++){let u=o[s].elements.find(c=>c.elementName.toLowerCase()===t.toLowerCase());if(u){let c=u.elementType;if(c==="functionBlock"||c==="function"||c==="struct"||c==="alias")return u;if(c==="enum")return u}}}}function Ge(t){if(Za.get(pr)&&el.get(pr)){let e=Za.get(pr),r=el.get(pr);if(e){let n=xi(e);for(let i=0;i<n.length;i++){let a=n[i].elements.find(l=>l.elementName.toLowerCase()===t.toLowerCase());if(a){let l=a.elementType;if(l==="functionBlock"||l==="function"||l==="struct"||l==="alias")return[a,r]}}}}else{let e=__dirname,r=a_(`${e}\\data.json`),i=Lp.serializer.JsonSerializer.deserialize(r),o=Wu.workspace.LangiumDocumentFactory.fromModel(i,Pe.parse("memory://cache.st")),a=JSON.parse(r);Za.set(pr,a),el.set(pr,o);let l=xi(a);for(let u=0;u<l.length;u++){let d=l[u].elements.find(m=>m.elementName.toLowerCase()===t.toLowerCase());if(d){let m=d.elementType;if(m==="functionBlock"||m==="function"||m==="struct"||m==="alias")return[d,o]}}}}function Ni(t){if(Za.get(pr)&&el.get(pr)){let e=Za.get(pr),r=el.get(pr);if(e){let n=xi(e);for(let i=0;i<n.length;i++){let a=n[i].elements.find(l=>l.elementName.toLowerCase()===t.toLowerCase());if(a&&a.elementType==="enum")return[a,r]}}}else{let e=__dirname,r=a_(`${e}\\data.json`),i=Lp.serializer.JsonSerializer.deserialize(r),o=Wu.workspace.LangiumDocumentFactory.fromModel(i,Pe.parse("memory://cache.st")),a=JSON.parse(r);Za.set(pr,a),el.set(pr,o);let l=xi(a);for(let u=0;u<l.length;u++){let d=l[u].elements.find(m=>m.elementName.toLowerCase()===t.toLowerCase());if(d&&d.elementType==="enum")return[d,o]}}}function a_(t){try{return zC.default.readFileSync(t,"utf8")}catch(e){return console.error(e),""}}var kp=t=>/^-?[1-9]\d*$/.test(t)||/^0$/.test(t),FG=t=>/^[a-z]+$/.test(t),UG=t=>{let e=Ge(t);if(!e)return!0;let[r]=e;return r?r.elementName===r.elementName.toUpperCase():!0},XC=/^(?:TIME|T)#(\d+y)?(\d+m)?(\d+d)?(\d+h)?(\d+m)?(\d+s)?(\d+ms)?$/i,JC=/^DATE#\d{4}-\d{2}-\d{2}$/i,QC=/^DT#\d{4}-\d{2}-\d{2}-\d{2}:\d{2}:\d{2}(?:\.\d+)?$/i,ZC=/^TOD#\d{2}:\d{2}:\d{2}(?:\.\d+)?$/i,VG=["SINT","INT","DINT","LINT","USINT","UINT","UDINT","ULINT","BYTE","WORD","DWORD","LWORD","TIME","DATE","LREAL","REAL","BOOL","STRING","ANY","ANY_DERIVED","ANY_ELEMENTARY","ANY_MAGNITUDE","ANY_NUM","ANY_REAL","ANY_INT","ANY_BIT","ANY_NBIT","ANY_STRING","ANY_DATE"],wp=["RTC","INTEGRAL","DERIVATIVE","PID","RAMP","HYSTERESIS","SR","RS","SEMA","R_TRIG","F_TRIG","CTU","CTU_DINT","CTU_LINT","CTU_UDINT","CTU_ULINT","CTD","CTD_DINT","CTD_LINT","CTD_UDINT","CTD_ULINT","CTUD","CTUD_DINT","CTUD_LINT","CTUD_UDINT","CTUD_ULINT","TP","TON","TOF","MC_POWER","MC_READACTUALPOSITION","MC_MOVEABSOLUTE","MC_MOVERELATIVE","MC_MOVEADDITIVE","MC_MOVESUPERIMPOSED","MC_MOVEVELOCITY","MC_POSITIONPROFILE","MC_VELOCITYPROFILE","MC_READACTUALVELOCITY","MC_ACCELERATIONPROFILE","MC_SETPOSITION","MC_READPARAMETER","MC_READBOOLPARAMETER","MC_WRITEPARAMETER","MC_WRITEBOOLPARAMETER","MC_READACTUALTORQUE","MC_READSTATUS","MC_READAXISERROR","MC_RESET","MC_DIGITALCAMSWITCH","MC_TOUCHPROBE","MC_ABORTTRIGGER","MC_STOP","MC_HALT","MC_HOME","MC_CAMTABLESELECT","MC_CAMIN","MC_CAMOUT","MC_GEARIN","MC_GEAROUT","MC_GEARINPOS","MC_PHASING","SMC_TRACKAXIS","SMC_TRACKSETVALUES","MC_STARTTRACE","SMC_MOVECONTINUOUSABSOLUTE","SMC_MOVECONTINUOUSRELATIVE","SMC_GETTAPPETVALUE"],BG=["BOOL_TO_SINT","BOOL_TO_INT","BOOL_TO_DINT","BOOL_TO_LINT","BOOL_TO_USINT","BOOL_TO_UINT","BOOL_TO_UDINT","BOOL_TO_ULINT","BOOL_TO_REAL","BOOL_TO_LREAL","BOOL_TO_TIME","BOOL_TO_DATE","BOOL_TO_TOD","BOOL_TO_DT","BOOL_TO_STRING","BOOL_TO_BYTE","BOOL_TO_WORD","BOOL_TO_DWORD","BOOL_TO_LWORD","SINT_TO_BOOL","SINT_TO_INT","SINT_TO_DINT","SINT_TO_LINT","SINT_TO_USINT","SINT_TO_UINT","SINT_TO_UDINT","SINT_TO_ULINT","SINT_TO_REAL","SINT_TO_LREAL","SINT_TO_TIME","SINT_TO_DATE","SINT_TO_TOD","SINT_TO_DT","SINT_TO_STRING","SINT_TO_BYTE","SINT_TO_WORD","SINT_TO_DWORD","SINT_TO_LWORD","INT_TO_BOOL","INT_TO_SINT","INT_TO_DINT","INT_TO_LINT","INT_TO_USINT","INT_TO_UINT","INT_TO_UDINT","INT_TO_ULINT","INT_TO_REAL","INT_TO_LREAL","INT_TO_TIME","INT_TO_DATE","INT_TO_TOD","INT_TO_DT","INT_TO_STRING","INT_TO_BYTE","INT_TO_WORD","INT_TO_DWORD","INT_TO_LWORD","DINT_TO_BOOL","DINT_TO_SINT","DINT_TO_INT","DINT_TO_LINT","DINT_TO_USINT","DINT_TO_UINT","DINT_TO_UDINT","DINT_TO_ULINT","DINT_TO_REAL","DINT_TO_LREAL","DINT_TO_TIME","DINT_TO_DATE","DINT_TO_TOD","DINT_TO_DT","DINT_TO_STRING","DINT_TO_BYTE","DINT_TO_WORD","DINT_TO_DWORD","DINT_TO_LWORD","LINT_TO_BOOL","LINT_TO_SINT","LINT_TO_INT","LINT_TO_DINT","LINT_TO_USINT","LINT_TO_UINT","LINT_TO_UDINT","LINT_TO_ULINT","LINT_TO_REAL","LINT_TO_LREAL","LINT_TO_TIME","LINT_TO_DATE","LINT_TO_TOD","LINT_TO_DT","LINT_TO_STRING","LINT_TO_BYTE","LINT_TO_WORD","LINT_TO_DWORD","LINT_TO_LWORD","USINT_TO_BOOL","USINT_TO_SINT","USINT_TO_INT","USINT_TO_DINT","USINT_TO_LINT","USINT_TO_UINT","USINT_TO_UDINT","USINT_TO_ULINT","USINT_TO_REAL","USINT_TO_LREAL","USINT_TO_TIME","USINT_TO_DATE","USINT_TO_TOD","USINT_TO_DT","USINT_TO_STRING","USINT_TO_BYTE","USINT_TO_WORD","USINT_TO_DWORD","USINT_TO_LWORD","UINT_TO_BOOL","UINT_TO_SINT","UINT_TO_INT","UINT_TO_DINT","UINT_TO_LINT","UINT_TO_USINT","UINT_TO_UDINT","UINT_TO_ULINT","UINT_TO_REAL","UINT_TO_LREAL","UINT_TO_TIME","UINT_TO_DATE","UINT_TO_TOD","UINT_TO_DT","UINT_TO_STRING","UINT_TO_BYTE","UINT_TO_WORD","UINT_TO_DWORD","UINT_TO_LWORD","UDINT_TO_BOOL","UDINT_TO_SINT","UDINT_TO_INT","UDINT_TO_DINT","UDINT_TO_LINT","UDINT_TO_USINT","UDINT_TO_UINT","UDINT_TO_ULINT","UDINT_TO_REAL","UDINT_TO_LREAL","UDINT_TO_TIME","UDINT_TO_DATE","UDINT_TO_TOD","UDINT_TO_DT","UDINT_TO_STRING","UDINT_TO_BYTE","UDINT_TO_WORD","UDINT_TO_DWORD","UDINT_TO_LWORD","ULINT_TO_BOOL","ULINT_TO_SINT","ULINT_TO_INT","ULINT_TO_DINT","ULINT_TO_LINT","ULINT_TO_USINT","ULINT_TO_UINT","ULINT_TO_UDINT","ULINT_TO_REAL","ULINT_TO_LREAL","ULINT_TO_TIME","ULINT_TO_DATE","ULINT_TO_TOD","ULINT_TO_DT","ULINT_TO_STRING","ULINT_TO_BYTE","ULINT_TO_WORD","ULINT_TO_DWORD","ULINT_TO_LWORD","REAL_TO_BOOL","REAL_TO_SINT","REAL_TO_INT","REAL_TO_DINT","REAL_TO_LINT","REAL_TO_USINT","REAL_TO_UINT","REAL_TO_UDINT","REAL_TO_ULINT","REAL_TO_LREAL","REAL_TO_TIME","REAL_TO_DATE","REAL_TO_TOD","REAL_TO_DT","REAL_TO_STRING","REAL_TO_BYTE","REAL_TO_WORD","REAL_TO_DWORD","REAL_TO_LWORD","LREAL_TO_BOOL","LREAL_TO_SINT","LREAL_TO_INT","LREAL_TO_DINT","LREAL_TO_LINT","LREAL_TO_USINT","LREAL_TO_UINT","LREAL_TO_UDINT","LREAL_TO_ULINT","LREAL_TO_REAL","LREAL_TO_TIME","LREAL_TO_DATE","LREAL_TO_TOD","LREAL_TO_DT","LREAL_TO_STRING","LREAL_TO_BYTE","LREAL_TO_WORD","LREAL_TO_DWORD","LREAL_TO_LWORD","TIME_TO_SINT","TIME_TO_INT","TIME_TO_DINT","TIME_TO_LINT","TIME_TO_USINT","TIME_TO_UINT","TIME_TO_UDINT","TIME_TO_ULINT","TIME_TO_REAL","TIME_TO_LREAL","TIME_TO_STRING","TIME_TO_BYTE","TIME_TO_WORD","TIME_TO_DWORD","TIME_TO_LWORD","DATE_TO_SINT","DATE_TO_INT","DATE_TO_DINT","DATE_TO_LINT","DATE_TO_USINT","DATE_TO_UINT","DATE_TO_UDINT","DATE_TO_ULINT","DATE_TO_REAL","DATE_TO_LREAL","DATE_TO_STRING","DATE_TO_BYTE","DATE_TO_WORD","DATE_TO_DWORD","DATE_TO_LWORD","TOD_TO_SINT","TOD_TO_INT","TOD_TO_DINT","TOD_TO_LINT","TOD_TO_USINT","TOD_TO_UINT","TOD_TO_UDINT","TOD_TO_ULINT","TOD_TO_REAL","TOD_TO_LREAL","TOD_TO_STRING","TOD_TO_BYTE","TOD_TO_WORD","TOD_TO_DWORD","TOD_TO_LWORD","DT_TO_SINT","DT_TO_INT","DT_TO_DINT","DT_TO_LINT","DT_TO_USINT","DT_TO_UINT","DT_TO_UDINT","DT_TO_ULINT","DT_TO_REAL","DT_TO_LREAL","DT_TO_STRING","DT_TO_BYTE","DT_TO_WORD","DT_TO_DWORD","DT_TO_LWORD","STRING_TO_BOOL","STRING_TO_SINT","STRING_TO_INT","STRING_TO_DINT","STRING_TO_LINT","STRING_TO_USINT","STRING_TO_UINT","STRING_TO_UDINT","STRING_TO_ULINT","STRING_TO_REAL","STRING_TO_LREAL","STRING_TO_TIME","STRING_TO_DATE","STRING_TO_TOD","STRING_TO_DT","STRING_TO_BYTE","STRING_TO_WORD","STRING_TO_DWORD","STRING_TO_LWORD","BYTE_TO_BOOL","BYTE_TO_SINT","BYTE_TO_INT","BYTE_TO_DINT","BYTE_TO_LINT","BYTE_TO_USINT","BYTE_TO_UINT","BYTE_TO_UDINT","BYTE_TO_ULINT","BYTE_TO_REAL","BYTE_TO_LREAL","BYTE_TO_TIME","BYTE_TO_DATE","BYTE_TO_TOD","BYTE_TO_DT","BYTE_TO_STRING","BYTE_TO_WORD","BYTE_TO_DWORD","BYTE_TO_LWORD","WORD_TO_BOOL","WORD_TO_SINT","WORD_TO_INT","WORD_TO_DINT","WORD_TO_LINT","WORD_TO_USINT","WORD_TO_UINT","WORD_TO_UDINT","WORD_TO_ULINT","WORD_TO_REAL","WORD_TO_LREAL","WORD_TO_TIME","WORD_TO_DATE","WORD_TO_TOD","WORD_TO_DT","WORD_TO_STRING","WORD_TO_BYTE","WORD_TO_DWORD","WORD_TO_LWORD","DWORD_TO_BOOL","DWORD_TO_SINT","DWORD_TO_INT","DWORD_TO_DINT","DWORD_TO_LINT","DWORD_TO_USINT","DWORD_TO_UINT","DWORD_TO_UDINT","DWORD_TO_ULINT","DWORD_TO_REAL","DWORD_TO_LREAL","DWORD_TO_TIME","DWORD_TO_DATE","DWORD_TO_TOD","DWORD_TO_DT","DWORD_TO_STRING","DWORD_TO_BYTE","DWORD_TO_WORD","DWORD_TO_LWORD","LWORD_TO_BOOL","LWORD_TO_SINT","LWORD_TO_INT","LWORD_TO_DINT","LWORD_TO_LINT","LWORD_TO_USINT","LWORD_TO_UINT","LWORD_TO_UDINT","LWORD_TO_ULINT","LWORD_TO_REAL","LWORD_TO_LREAL","LWORD_TO_TIME","LWORD_TO_DATE","LWORD_TO_TOD","LWORD_TO_DT","LWORD_TO_STRING","LWORD_TO_BYTE","LWORD_TO_WORD","LWORD_TO_DWORD","TRUNC","BCD_TO_USINT","BCD_TO_UINT","BCD_TO_UDINT","BCD_TO_ULINT","USINT_TO_BCD","UINT_TO_BCD","UDINT_TO_BCD","ULINT_TO_BCD","DATE_AND_TIME_TO_TIME_OF_DAY","DATE_AND_TIME_TO_DATE"],eb=["ABS","SQRT","LN","LOG","EXP","SIN","COS","TAN","ASIN","ACOS","ATAN"],tb=["ADD","MUL","SUB","DIV","MOD","EXPT","MOVE"],WG=["ADD_TIME","ADD_TOD_TIME","ADD_DT_TIME","MULTIME","SUB_TIME","SUB_DATE_DATE","SUB_TOD_TIME","SUB_TOD_TOD","SUB_DT_TIME","SUB_DT_DT","DIVTIME"],rb=["SHL","SHR","ROR","ROL"],nb=["AND","OR","XOR","NOT"],ib=["SEL","MAX","MIN","LIMIT","MUX"],ob=["GT","GE","EQ","LT","LE","NE"],sb=["LEN","LEFT","RIGHT","MID","CONCAT","CONCAT_DATE_TOD","INSERT","DELETE","REPLACE","FIND"],GG=["SMC_READAXISINFO","SMC_GETTIMENS","SMC_PARAMETERNUMBER_COE"],jG=["AXIS_REF","MC_CAM_REF"],$p=["SMC_ERROR","MC_Direction","MC_BUFFER_MODE","SMC_AXIS_STATE","MC_TAPPETMODE","SMC_CAM_TYPE","MC_STARTMODE"],ab=VG.concat(wp).concat(jG),Gu=BG.concat(eb).concat(tb).concat(WG).concat(rb).concat(nb).concat(ib).concat(ob).concat(sb).concat(GG),qG=ab.concat(Gu).concat($p),Pp=wp.concat(Gu),lb=eb.concat(tb).concat(rb).concat(nb).concat(ib).concat(ob).concat(sb.filter(t=>t!=="CONCAT_DATE_TOD"));function ub(t){let e=new RegExp("^"+t,"i");return Gu.filter(r=>e.test(r))}function cb(t){let e=new RegExp("^"+t,"i");return qG.filter(r=>e.test(r))}function fb(t){let e=new RegExp("^"+t,"i");return $p.filter(r=>e.test(r))}function db(t){let e=new RegExp("^"+t,"i");return Pp.filter(r=>e.test(r))}function c_(t,e){let r;return e==="TIME"?r=XC:e==="DATE"?r=JC:e==="DATE_AND_TIME"?r=QC:e==="TIME_OF_DAY"&&(r=ZC),r?r.exec(t)?"":`Invalid ${e} format`:`Invalid ${e} format`}function Xe(t,e){e&&(t=e.Real_type_name||e.Bit_string_type_name||e.Integer_type_name||e.Unsigned_integer_type_name||e.Bool_type_name||e.String_type_name||e.Date_type_name||e.Time_type_name||e.Date_And_time_type_name||e.Time_Of_Day_type_name||e.Any_type_name||e.Cache_type_name);let r=t==null?void 0:t.toUpperCase();return r==="DT"?"DATE_AND_TIME":r==="TOD"?"TIME_OF_DAY":r&&pb.includes(r)?r:t}var f_=["SINT","INT","DINT","LINT"],d_=["USINT","UINT","UDINT","ULINT"],p_=["BYTE","WORD","DWORD","LWORD"],m_=["REAL","LREAL"],HG=["DATE","TIME","DATE_AND_TIME","TIME_OF_DAY"],h_=["ANY","ANY_DERIVED","ANY_ELEMENTARY","ANY_MAGNITUDE","ANY_NUM","ANY_REAL","ANY_INT","ANY_BIT","ANY_NBIT","ANY_STRING","ANY_DATE"],pb=f_.concat(d_).concat(p_).concat(m_).concat(["BOOL","STRING"]).concat(HG).concat(h_);function mb(t){if(!t)return;let e=t.toUpperCase();return e==="DT"?"DATE_AND_TIME":e==="TOD"?"TIME_OF_DAY":e}function l_(t){var n;let e={$type:"Native_Type_Name"},r=(n=mb(t))!=null?n:t.toUpperCase();return m_.includes(r)?e.Real_type_name=r:p_.includes(r)?e.Bit_string_type_name=r:f_.includes(r)?e.Integer_type_name=r:d_.includes(r)?e.Unsigned_integer_type_name=r:r==="BOOL"?e.Bool_type_name=r:r==="STRING"?e.String_type_name=r:r==="DATE"?e.Date_type_name=r:r==="TIME"?e.Time_type_name=r:r==="DATE_AND_TIME"?e.Date_And_time_type_name=r:r==="TIME_OF_DAY"?e.Time_Of_Day_type_name=r:h_.includes(r)?e.Any_type_name=r:e.Cache_type_name=t,e}function KG(t,e){if(e===void 0)return;let r;return typeof e=="boolean"?r=e?"TRUE":"FALSE":r=e,{$container:t,$type:"Constant",constant:r}}function u_(t,e=new Set){var l,u,c;if(!t)return{};let r=(l=mb(t))!=null?l:t.toUpperCase();if(f_.includes(r)||d_.includes(r)||p_.includes(r)||m_.includes(r)||r==="BOOL"||r==="STRING"||r==="DATE"||r==="TIME"||r==="DATE_AND_TIME"||r==="TIME_OF_DAY"||h_.includes(r))return{typeName:r};let n=Ge(t);if(!n)return{typeName:t};let[i]=n;if(!i||i.elementType!=="alias")return{typeName:t};let o=i,s=o.elementName.toUpperCase();if(e.has(s))return{typeName:o.elementName,refNode:o};e.add(s);let a=u_(o.refName,e);return{typeName:(u=a.typeName)!=null?u:o.elementName,refNode:(c=a.refNode)!=null?c:o}}function Mp(t,e=new Set){var o;if(!t)return{};let r=Xe(void 0,t);if(r)return t.Cache_type_name?u_(t.Cache_type_name,e):{typeName:r};let n=t.Identifier;if(!n)return{};let i=n.ref;if(!i)return u_(n.$refText,e);if(Dp(i)){if(e.has(i.name))return{typeName:i.name,refNode:i};e.add(i.name);let s=Mp(i.refName,e);return{typeName:(o=s.typeName)!=null?o:i.name,refNode:s.refNode}}return"name"in i&&typeof i.name=="string"?{typeName:i.name,refNode:i}:{typeName:n.$refText}}function g_(t){return Mp(t).typeName}function po(t){return/^[-+]?[0-9]*\.[0-9]+([eE][-+]?[0-9]+)?$/.test(t)}function T_(t){return/^\d*\.?\d+$/.test(t)}function zG(t){let e=t.toUpperCase(),r=pb.concat(ab).find(n=>n.toUpperCase()===e);return r?[r,!0]:[null,!1]}function YG(t){return["SINT","USINT","INT","UINT","DINT","UDINT","LINT","WORD","DWORD","LWORD","BYTE","BOOL","ULINT"].includes(t)}function fs(t,e,r){if(!t||!e||(t=t.toUpperCase(),e=e.toUpperCase(),!YG(e)))return!0;if(t&&t.toLowerCase()==="bool")return r?r!==1&&r!==0:!1;if(e&&e.toLowerCase()==="bool"&&r&&r!==1&&r!==0)return!0;switch(t){case"SINT":return e==="BOOL";case"INT":return e==="SINT"||e==="BYTE";case"UINT":return e==="SINT"||e==="INT"||e==="BYTE";case"DINT":return e==="SINT"||e==="INT"||e==="UINT"||e==="WORD"||e==="BYTE";case"UDINT":return e==="SINT"||e==="INT"||e==="UINT"||e==="DINT"||e==="WORD"||e==="BYTE";case"LINT":return e==="SINT"||e==="INT"||e==="UINT"||e==="DINT"||e==="UDINT"||e==="WORD"||e==="DWORD"||e==="BYTE";case"BYTE":return!(e==="BYTE"||e==="USINT"||e==="SINT"||e==="INT"||e==="UINT"||e==="DINT"||e==="UDINT"||e==="LINT"||e==="ULINT");case"ULINT":return e==="SINT"||e==="USINT"||e==="INT"||e==="UINT"||e==="DINT"||e==="UDINT"||e==="LINT"||e==="WORD"||e==="DWORD"||e==="LWORD"||e==="BYTE";default:return!0}}function mo(t){let e="";return Xa(t),t.$type==="Constant"?e=t.constant.toString():e=t.toString(),e.toLowerCase()==="true"||e.toLowerCase()==="false"?["BOOL"]:XC.test(e)?["TIME"]:JC.test(e)?["DATE"]:QC.test(e)?["DATE_AND_TIME"]:ZC.test(e)?["TIME_OF_DAY"]:/^-?\d+$/.test(e)?["INT","UINT","DINT","UDINT","LINT","SINT","USINT","BYTE","WORD","DWORD","LWORD"]:po(e)?["REAL","LREAL"]:typeof e=="string"?["STRING"]:["UNKNOWN"]}function XG(t,e,r){var u;let n,i=Xe(t,e);t=(u=Mp(e).typeName)!=null?u:i,e.Real_type_name?n="Real_type_name":e.Bit_string_type_name?n="Bit_string_type_name":e.Integer_type_name?n="Integer_type_name":e.Unsigned_integer_type_name?n="Unsigned_integer_type_name":e.Bool_type_name?n="Bool_type_name":e.String_type_name?n="String_type_name":e.Date_And_time_type_name?n="Date_And_time_type_name":e.Date_type_name?n="Date_type_name":e.Time_Of_Day_type_name?n="Time_Of_Day_type_name":e.Time_type_name?n="Time_type_name":e.Any_type_name?n="Any_type_name":e.Cache_type_name?n="Cache_type_name":n="String_type_name";let s=i!=null?i:t,[a,l]=zG(s);if(l)s!==a&&(FG(s)||(n!=="Cache_type_name"||!e.Cache_type_name||UG(e.Cache_type_name))&&r("hint",`did you mean '${a}'?`,{node:e,property:n}));else if(n==="Cache_type_name"){let c=e.Cache_type_name;if(c){let f=Ge(c);if(f){let[d,m]=f;d&&d.elementType==="function"&&r("error",`${t}\u7684\u7C7B\u578B\u4E3AFUNCTION,\u4E0D\u80FD\u5B9E\u4F8B\u5316`,{node:e,property:"Identifier"})}}}return t}function kn(t,e,r){if(!t)return e;if(t.Identifier){let n=t.Identifier,i=Mp(t),o=n.ref;if(i.typeName&&(e=i.typeName),o){let s=i.refNode;(bn(o)||s&&bn(s))&&r("error",`${e}\u7684\u7C7B\u578B\u4E3AFUNCTION,\u4E0D\u80FD\u5B9E\u4F8B\u5316`,{node:t,property:"Identifier"})}else{let s=n.$nodeDescription;s&&s.type==="FunctionElement"&&r("error",`${n.$refText}\u7684\u7C7B\u578B\u4E3AFUNCTION,\u4E0D\u80FD\u5B9E\u4F8B\u5316`,{node:t,property:"Identifier"})}}else r&&(e=XG(e,t,r));return e}function $t(t,e){let r=g_(t);return r?e=r:e=Xe(e,t),e}function hb(t){let e={$type:"St",function_block:[],globalVarLists:[],itface:[],program:[],st_function:[],types_alias:[],types_enum:[],types_struct:[],types_union:[]};return t.forEach(r=>{r.elements.forEach(i=>{if(i.elementType==="alias"){let s=i,a={$container:e,$type:"Alias",name:s.elementName,refName:l_(s.refName)},l=KG(a,s.initialValue);l&&(a.initialValue=l),e.types_alias.push(a);return}if(i.elementType==="enum"){let s=i,a={$container:e,$type:"StEnum",enum:[],name:s.elementName};s.enumChild.forEach(l=>{let u={$container:a,$type:"Enum",variable_name:l.enumVarName};l.assignValue!==void 0&&(u.assignValue=l.assignValue.toString()),a.enum.push(u)}),e.types_enum.push(a);return}let o=i.elementType;if(o==="struct"){i=i;let s=i.varDecls,a={$container:e,$type:"StructsList",items:[],name:""};a.name=i.elementName,s.forEach(l=>{let u=l.varName,c=l.varType,f=l_(c),d={$container:a,$type:"Struct_Var_Decl_Init",nextVariables:[],typeName:f,variables:u};a.items.push(d)}),e.types_struct.push(a)}else if(o==="functionBlock"){i=i;let s=i.varDecls,a={$container:e,$type:"FunctionBlock",name:"",statementList:[],methods:[],varExternals:[],varInputs:[],varLocals:[],varOutputs:[]};a.name=i.elementName,s.forEach(l=>{let u=l.varName,c=l.varType,f=l.varGlobalType,d=l_(c);if(f){let m;if(f==="VAR_INPUT"){let _={$container:a,$type:"VarInput",items:[]};m={$container:_,$type:"VarDeclarationInit",nextVariables:[],typeName:d,variables:u},_.items.push(m),a.varInputs.push(_)}else if(f==="VAR"){let _={$container:a,$type:"VarLocal",items:[]};m={$container:_,$type:"VarDeclarationInit",nextVariables:[],typeName:d,variables:u},_.items.push(m),a.varLocals.push(_)}}}),e.function_block.push(a)}})}),e}function xi(t){let e=[];return t.forEach(r=>{let n=r.name,i=r.list;if(n==="Additional function blocks"||n==="Standard function blocks"||n==="SMC_Basic function blocks"){let o=i,s={$type:"ComposeNode",elements:[]};for(let a=0;a<o.length;a++){let l=o[a],u=l.inputs,c=l.outputs,f={$type:"FunctionBlockElement",elementType:"functionBlock",elementName:l.name,varDecls:[],rootName:n,comment:l.comment,usage:l.usage};u.forEach(d=>{let m={$type:"VarDeclaration",varName:d[0],varType:d[1],varGlobalType:"VAR_INPUT"};f.varDecls.push(m)}),c.forEach(d=>{let m={$type:"VarDeclaration",varName:d[0],varType:d[1],varGlobalType:"VAR_OUTPUT"};f.varDecls.push(m)}),s.elements.push(f),a===o.length-1&&e.push(s)}}else if(n==="extra_library"){let o=i,s={$type:"ComposeNode",elements:[]};for(let a=0;a<o.length;a++){let l=o[a];if(l.type==="struct"){let u={$type:"SingleElement",elementType:"struct",elementName:l.name,varDecls:[],rootName:n,comment:l.comment};l.elements.forEach(c=>{let f={$type:"VarDeclaration",varName:c.name,varType:c.type};u.varDecls.push(f)}),s.elements.push(u)}else if(l.type==="derived"){let u={$type:"AliasElement",elementType:"alias",elementName:l.name,refName:l.base_type,initialValue:l.value,varDecls:[],rootName:n,comment:l.comment};s.elements.push(u)}else if(l.type==="enum"){let u={$type:"EnumElement",elementType:"enum",elementName:l.name,enumChild:l.values.map(c=>({enumVarName:c})),rootName:n,comment:l.comment};s.elements.push(u)}}s.elements.length>0&&e.push(s)}else{let o=i,s={$type:"ComposeNode",elements:[]};for(let a=0;a<o.length;a++){let l=o[a],u=l.inputs,c=l.outputs,f={$type:"FunctionElement",elementType:"function",elementName:l.name,varDecls:[],rootName:n,comment:l.comment};u.forEach(d=>{let m={$type:"VarDeclaration",varName:d[0],varType:d[1],varGlobalType:"VAR_INPUT"};f.varDecls.push(m)}),c.forEach(d=>{let m={$type:"VarDeclaration",varName:d[0],varType:d[1],varGlobalType:"VAR_OUTPUT"};f.varDecls.push(m)}),s.elements.push(f),a===o.length-1&&e.push(s)}}}),e}var Fp=class extends Xs{constructor(r){super(r);this.services=r;this.completionOptions={triggerCharacters:[".","#"]}}async getCompletion(r,n){var l;let i=this.getManualEnumCompletionItems(r,n);if(i)return lt.CompletionList.create(this.deduplicateItems(i),!0);let o=await super.getCompletion(r,n),s=await this.getManualMemberCompletionItems(r,n);if(s.length===0)return o;let a=this.mergeOverrideItems((l=o==null?void 0:o.items)!=null?l:[],s);return s.length>0&&(a=this.prioritizeItems(a,s)),lt.CompletionList.create(this.deduplicateItems(a),!0)}completionFor(r,n,i){let o=n.property;if(!o){let s=Qt.getContainerOfType(n.feature,st.isAssignment);o=s==null?void 0:s.feature}if(o==="enumValue"){let s=this.getEnumTypeNameBeforeHash(r);if(s){this.hintEnumMembers(s,i,r);return}}else if(o==="simpleEnumCase"){let s=this.getCaseEnumTypeName(r);if(s){this.hintEnumMembers(s,i,r);return}}return super.completionFor(r,n,i)}hintFunctionBlockDecl(r,n,i){r.forEach(o=>{o.items.forEach(a=>{let{expectedType:l,variable:u,typeName:c,nextVariables:f}=this.getDataType(a);this.handleStructOrFunctionBlockVarDecl(l,n,i,u,c),f.forEach(d=>{this.handleStructOrFunctionBlockVarDecl(l,n,i,d,c)})})})}getVarDeclDetail(r){let n=r.varGlobalType;return n==="VAR_INPUT"||n==="VAR_OUTPUT"?`${n==="VAR_INPUT"?"\u8F93\u5165\u53C2\u6570":"\u8F93\u51FA\u53C2\u6570"}, \u7C7B\u578B\u662F${r.varType}`:`${r.varType}`}hintCacheVarDecls(r,n,i,o="1"){r==null||r.forEach(s=>{n(i,{label:s.varName,kind:lt.CompletionItemKind.Field,detail:this.getVarDeclDetail(s),sortText:o})})}createReferenceCompletionItem(r){let n="";if(r&&r.node){if(r.type==="Struct_Var_Decl_Init"){let o=r.node.typeName,s="";n=Xe(s,o),n||(n=$t(o,s)),n||o.$type==="Array_liters"&&(n="Array")}if(r.node.$type==="VarDeclaration"){let i=r.node;return{nodeDescription:r,kind:lt.CompletionItemKind.Field,detail:this.getVarDeclDetail(i),sortText:"0"}}else if(r.node.$type==="VarDeclarationInit"){let o=r.node.typeName,s="";if(s=Xe(s,o),s!==""&&s){let a=Ge(s);if(a){let[l,u]=a,c=l==null?void 0:l.elementType;if(c==="functionBlock"||c==="struct"){let f=l==null?void 0:l.varDecls;f==null||f.forEach(d=>({nodeDescription:r,kind:lt.CompletionItemKind.Field,detail:this.getVarDeclDetail(d),sortText:"0"}))}}}}}return{nodeDescription:r,kind:lt.CompletionItemKind.Reference,detail:n,sortText:"0"}}getRangeText(r){let n=r.position,o={start:lt.Position.create(n.line,0),end:r.position};return r.textDocument.getText(o)}getCurrentTokenText(r){let i={start:r.textDocument.positionAt(r.tokenOffset),end:r.position};return r.textDocument.getText(i).trim()}mergeSupplementalItems(r,n){let i=[...r],o=new Map(r.map((s,a)=>[s.label.toLowerCase(),a]));return n.forEach(s=>{var u;let a=s.label.toLowerCase(),l=o.get(a);if(l!==void 0){let c=i[l];this.shouldPreferSupplemental(c,s)&&(i[l]={...c,detail:(u=s.detail)!=null?u:c.detail});return}o.set(a,i.length),i.push(s)}),i}mergeOverrideItems(r,n){let i=[...r],o=new Map(r.map((s,a)=>[s.label.toLowerCase(),a]));return n.forEach(s=>{let a=s.label.toLowerCase(),l=o.get(a);l!==void 0?i[l]=s:(o.set(a,i.length),i.push(s))}),i}prioritizeItems(r,n){let i=new Set(n.map(a=>a.label.toLowerCase())),o=this.deduplicateItems(n),s=r.filter(a=>!i.has(a.label.toLowerCase()));return[...o,...s]}shouldPreferSupplemental(r,n){var l,u;let i=(l=r.detail)!=null?l:"",o=(u=n.detail)!=null?u:"";if(!o)return!1;if(!i)return!0;let s=i.includes("\u8F93\u5165\u53C2\u6570")||i.includes("\u8F93\u51FA\u53C2\u6570");return(o.includes("\u8F93\u5165\u53C2\u6570")||o.includes("\u8F93\u51FA\u53C2\u6570"))&&!s?!0:o.length>i.length}getManualEnumCompletionItems(r,n){var f;let i=r.textDocument,s=i.getText({start:lt.Position.create(0,0),end:n.position}).match(/([_a-zA-Z][\w_]*)#([_a-zA-Z][\w_]*)?$/);if(!s)return;let a=s[1],l=(f=s[2])!=null?f:"",u=i.offsetAt(n.position),c={document:r,textDocument:i,offset:u,position:n.position,tokenOffset:u-l.length,tokenEndOffset:u,features:[]};if(this.hasEnumType(a,c))return this.buildEnumMemberCompletionItems(a,l,c)}hasEnumType(r,n){return r?this.getLocalEnumByName(r,n)!==void 0||this.getWorkspaceEnumByName(r)!==void 0||Ni(r)!==void 0:!1}async getManualMemberCompletionItems(r,n){let s=r.textDocument.getText({start:lt.Position.create(0,0),end:n.position}).match(/([_a-zA-Z][\w_]*(?:\s*\.\s*[_a-zA-Z][\w_]*)*)\s*\.\s*$/);if(!s)return[];let a=s[1].split(".").map(c=>c.trim()).filter(Boolean);if(a.length===0)return[];let l=await this.getMembersForChain(a,r);return l.length===0?[]:[...l].sort((c,f)=>{var d,m;return((d=c.sortText)!=null?d:"").localeCompare((m=f.sortText)!=null?m:"")}).map(c=>{var f;return{label:c.label,kind:lt.CompletionItemKind.Field,detail:c.detail,sortText:(f=c.sortText)!=null?f:"0"}})}getRootNode(r){let n=r.document.parseResult.value;if(n.$type==="St")return n}getLocalEnumByName(r,n){if(!r)return;let i=this.getRootNode(n);return i==null?void 0:i.types_enum.find(o=>o.name.toLowerCase()===r.toLowerCase())}getWorkspaceEnumByName(r){if(!r)return;let n=this.services.shared.workspace.IndexManager,i=this.services.shared.workspace.LangiumDocuments,o=this.services.workspace.AstNodeLocator;for(let s of n.allElements("StEnum"))if(s.name.toLowerCase()===r.toLowerCase()){let a=i.getDocument(s.documentUri);if(a){let l=o.getAstNode(a.parseResult.value,s.path);if(l)return l}}}async getWorkspaceStructByName(r,n){if(!r)return;let i=await this.getSiblingStructByName(r,n);if(i)return i;let o=this.services.shared.workspace.IndexManager,s=this.services.shared.workspace.LangiumDocuments,a=this.services.workspace.AstNodeLocator;for(let l of o.allElements("StructsList"))if(l.name.toLowerCase()===r.toLowerCase()){let u=s.getDocument(l.documentUri);try{if(!u){if(l.documentUri.fsPath&&!ho.default.existsSync(l.documentUri.fsPath))continue;u=await s.getOrCreateDocument(l.documentUri)}if(u){let c=a.getAstNode(u.parseResult.value,l.path);if(c)return c}}catch{continue}}}async getSiblingStructByName(r,n){var a;if(!(n!=null&&n.uri.fsPath))return;let i=Ei.default.dirname(n.uri.fsPath);if(!ho.default.existsSync(i))return;let o=this.services.shared.workspace.LangiumDocuments,s=[];for(let l of ho.default.readdirSync(i)){if(!l.toLowerCase().endsWith(".st"))continue;let u=Pe.file(Ei.default.join(i,l)),f=(await o.getOrCreateDocument(u)).parseResult.value;if(f.$type==="St"){let d=f.types_struct.find(m=>m.name.toLowerCase()===r.toLowerCase());d&&s.push({fileName:l,struct:d})}}return(a=this.selectPreferredSiblingType(r,s))==null?void 0:a.struct}async getWorkspaceFunctionBlockByName(r,n){if(!r)return;let i=await this.getSiblingFunctionBlockByName(r,n);if(i)return i;let o=this.services.shared.workspace.IndexManager,s=this.services.shared.workspace.LangiumDocuments,a=this.services.workspace.AstNodeLocator;for(let l of o.allElements("FunctionBlock"))if(l.name.toLowerCase()===r.toLowerCase()){let u=s.getDocument(l.documentUri);try{if(!u){if(l.documentUri.fsPath&&!ho.default.existsSync(l.documentUri.fsPath))continue;u=await s.getOrCreateDocument(l.documentUri)}if(u){let c=a.getAstNode(u.parseResult.value,l.path);if(c)return c}}catch{continue}}}async getSiblingFunctionBlockByName(r,n){var a;if(!(n!=null&&n.uri.fsPath))return;let i=Ei.default.dirname(n.uri.fsPath);if(!ho.default.existsSync(i))return;let o=this.services.shared.workspace.LangiumDocuments,s=[];for(let l of ho.default.readdirSync(i)){if(!l.toLowerCase().endsWith(".st"))continue;let u=Pe.file(Ei.default.join(i,l)),f=(await o.getOrCreateDocument(u)).parseResult.value;if(f.$type==="St"){let d=f.function_block.find(m=>m.name.toLowerCase()===r.toLowerCase());d&&s.push({fileName:l,functionBlock:d})}}return(a=this.selectPreferredSiblingType(r,s))==null?void 0:a.functionBlock}selectPreferredSiblingType(r,n){if(n.length===0)return;let i=r.toLowerCase();return[...n].sort((o,s)=>{let a=Ei.default.basename(o.fileName,Ei.default.extname(o.fileName)).toLowerCase(),l=Ei.default.basename(s.fileName,Ei.default.extname(s.fileName)).toLowerCase(),u=a===i?0:1,c=l===i?0:1;return u!==c?u-c:o.fileName.localeCompare(s.fileName)})[0]}async getMembersForChain(r,n){let i=await this.getWorkspaceGlobalVarListByName(r[0]);if(i){if(r.length===1)return this.getGlobalVarListEntries(i);let s=this.getGlobalVarListMemberType(i,r[1]);if(!s)return[];for(let a=2;a<r.length;a++)if(s=await this.getMemberTypeByName(s,r[a],n),!s)return[];return await this.getMemberEntriesForType(s,n)}let o=this.getVariableTypeByName(r[0],n);if(!o)return[];for(let s=1;s<r.length;s++)if(o=await this.getMemberTypeByName(o,r[s],n),!o)return[];return await this.getMemberEntriesForType(o,n)}async getWorkspaceGlobalVarListByName(r){if(!r)return;let n=this.services.shared.workspace.IndexManager,i=this.services.shared.workspace.LangiumDocuments,o=this.services.workspace.AstNodeLocator;for(let s of n.allElements("GlobalVarList")){if(s.name.toLowerCase()!==r.toLowerCase())continue;let a=i.getDocument(s.documentUri);try{if(!a){if(s.documentUri.fsPath&&!ho.default.existsSync(s.documentUri.fsPath))continue;a=await i.getOrCreateDocument(s.documentUri)}if(a){let l=o.getAstNode(a.parseResult.value,s.path);if(l&&l.$type==="GlobalVarList")return l}}catch{continue}}}getGlobalVarListMemberType(r,n){var i;for(let o of(i=r.items)!=null?i:[])if(o.variables===n||o.nextVariables.includes(n)){let s="";return Xe(s,o.typeName)||$t(o.typeName,s)}}getGlobalVarListEntries(r){var o;let n=[],i=0;for(let s of(o=r.items)!=null?o:[]){let a="",u=Xe(a,s.typeName)||$t(s.typeName,a);n.push({label:s.variables,detail:u,sortText:this.buildMemberSortText(1,i++)}),s.nextVariables.forEach(c=>n.push({label:c,detail:u,sortText:this.buildMemberSortText(1,i++)}))}return n}getVariableTypeByName(r,n){let i=n.parseResult.value;if(i.$type!=="St")return;let o=i,s=[];o.program.forEach(a=>{a.inputs.forEach(l=>s.push(...l.items))}),o.function_block.forEach(a=>{a.varInputs.forEach(l=>s.push(...l.items)),a.varOutputs.forEach(l=>s.push(...l.items)),a.varLocals.forEach(l=>s.push(...l.items))}),o.st_function.forEach(a=>{a.varInputs.forEach(l=>s.push(...l.items)),a.varOutputs.forEach(l=>s.push(...l.items)),a.varLocals.forEach(l=>s.push(...l.items))});for(let a of s)if(a.variables===r||a.nextVariables.includes(r)){let l="";return Xe(l,a.typeName)||$t(a.typeName,l)}}async getMemberTypeByName(r,n,i){var l;let o=(l=this.getLocalStructByName(r,i))!=null?l:await this.getWorkspaceStructByName(r,i);if(o){for(let u of o.items)if(u.variables===n||u.nextVariables.includes(n)){let c="";return Xe(c,u.typeName)||$t(u.typeName,c)}}let s=await this.getWorkspaceFunctionBlockByName(r,i);if(s){let u=[...s.varInputs,...s.varOutputs,...s.varLocals];for(let c of u)for(let f of c.items)if(f.variables===n||f.nextVariables.includes(n)){let d="";return Xe(d,f.typeName)||$t(f.typeName,d)}}let a=Ge(r);if(a){let[u]=a,c=u==null?void 0:u.varDecls.find(f=>f.varName===n);return c==null?void 0:c.varType}}getLocalStructByName(r,n){if(!r)return;let i=n.parseResult.value;if(i.$type==="St")return i.types_struct.find(o=>o.name.toLowerCase()===r.toLowerCase())}async getMemberEntriesForType(r,n){var a,l;let i=(a=this.getLocalStructByName(r,n))!=null?a:await this.getWorkspaceStructByName(r,n);if(i){let u=[],c=0;for(let f of i.items){let d="",_=Xe(d,f.typeName)||$t(f.typeName,d);u.push({label:f.variables,detail:_,sortText:this.buildMemberSortText(1,c++)}),f.nextVariables.forEach(x=>u.push({label:x,detail:_,sortText:this.buildMemberSortText(1,c++)}))}return u}let o=await this.getWorkspaceFunctionBlockByName(r,n);if(o){let u=[],c=[...o.varInputs.map(d=>({kind:"VAR_INPUT",items:d.items})),...o.varOutputs.map(d=>({kind:"VAR_OUTPUT",items:d.items})),...o.varLocals.map(d=>({kind:"VAR",items:d.items}))],f=0;for(let d of c)for(let m of d.items){let _="",A=Xe(_,m.typeName)||$t(m.typeName,_),I=this.getVarDeclDetail({$type:"VarDeclaration",varName:m.variables,varType:A,varGlobalType:d.kind});u.push({label:m.variables,detail:I,sortText:this.buildMemberSortText(this.getMemberGroupRank(d.kind),f++)}),m.nextVariables.forEach(y=>u.push({label:y,detail:I,sortText:this.buildMemberSortText(this.getMemberGroupRank(d.kind),f++)}))}return u}let s=Ge(r);if(s){let[u]=s;return((l=u==null?void 0:u.varDecls)!=null?l:[]).map((c,f)=>({label:c.varName,detail:this.getVarDeclDetail(c),sortText:this.buildMemberSortText(this.getMemberGroupRank(c.varGlobalType),f)}))}return[]}getMemberGroupRank(r){return r==="VAR_INPUT"?0:r==="VAR_OUTPUT"?1:2}buildMemberSortText(r,n){return`${String(r).padStart(2,"0")}_${String(n).padStart(4,"0")}`}getEnumMembers(r,n){var a;if(!r)return[];let i=this.getLocalEnumByName(r,n);if(i)return i.enum.map(l=>l.variable_name);let o=this.getWorkspaceEnumByName(r);if(o)return o.enum.map(l=>l.variable_name);let s=Ni(r);if(s){let[l]=s;return(a=l==null?void 0:l.enumChild.map(u=>u.enumVarName))!=null?a:[]}return[]}getEnumeratedValueTypeName(r){var i,o;if(!r)return;if(r.enumCacheTypeName)return r.enumCacheTypeName;let n=(i=r.enumType)==null?void 0:i.ref;if(n){if(n.$type==="StEnum")return n.name;if("elementType"in n&&n.elementType==="enum"&&"elementName"in n){let s=n.elementName;if(typeof s=="string")return s}}return(o=r.enumType)==null?void 0:o.$refText}getEnumTypeNameBeforeHash(r){let i=r.textDocument.getText({start:lt.Position.create(0,0),end:r.textDocument.positionAt(r.tokenOffset)}).match(/([_a-zA-Z][\w_]*)\s*#\s*$/);return i==null?void 0:i[1]}getCaseEnumTypeName(r){let n=r.node;if(!n)return;let i=Qt.getContainerOfType(n,SC);if(i)return this.getEnumTypeNameFromCaseStatement(i)}getEnumTypeNameFromCaseStatement(r){let n=r.caseExpression;if(Tn(n))return this.getEnumeratedValueTypeName(n);if(Cn(n)){let i=n.prior;if(Tn(i))return this.getEnumeratedValueTypeName(i);if(Yt(i)){let o=i.variable.ref;if(At(o))return $t(o.typeName,"")}}}hintEnumMembers(r,n,i){let o=this.getCurrentTokenText(i);this.getEnumMembers(r,i).filter(a=>a.toLowerCase().startsWith(o.toLowerCase())).forEach(a=>{n(i,{label:a,kind:lt.CompletionItemKind.EnumMember,detail:r,sortText:"0"})})}buildEnumMemberCompletionItems(r,n,i){let o=[];return this.getEnumMembers(r,i).filter(a=>a.toLowerCase().startsWith(n.toLowerCase())).forEach(a=>{let l=this.fillCompletionItem(i,{label:a,kind:lt.CompletionItemKind.EnumMember,detail:r,sortText:"0"});l&&o.push(l)}),o}completionForKeyword(r,n,i){try{let o=r.node;if(Ja(o)){let s=o.varEnchanceDecl.ref,a=o.varEnchanceDecl.$refText;if(At(s)){let l=s.typeName,u="";if(u=Xe(u,l),u!==""&&u){let c=Ge(u);if(c){let[f,d]=c,m=f==null?void 0:f.elementType;(m==="functionBlock"||m==="struct")&&this.hintCacheVarDecls(f==null?void 0:f.varDecls,i,r)}}else{let c=l.Identifier;if(c){let f=c.ref;if(cs(f))f.items.forEach(m=>{let{expectedType:_,variable:x,typeName:A,nextVariables:I}=this.getDataType(m);this.handleStructOrFunctionBlockVarDecl(_,i,r,x,A),I.forEach(y=>{this.handleStructOrFunctionBlockVarDecl(_,i,r,y,A)})});else if(ei(f)){let d=f.varInputs,m=f.varOutputs,_=f.varLocals;this.hintFunctionBlockDecl(d,i,r),this.hintFunctionBlockDecl(m,i,r),this.hintFunctionBlockDecl(_,i,r)}}}}else db(a).forEach(u=>{let c=Ge(u);if(c){let[f,d]=c;i(r,{label:f==null?void 0:f.elementName,kind:lt.CompletionItemKind.Reference,detail:f==null?void 0:f.usage,sortText:"1"})}})}else{let s=this.getRangeText(r);s=s.trim();let a=s.indexOf(":"),l=s.substring(a+1);l=l.trim(),cb(l).forEach(c=>{if(wp.includes(c)||Gu.includes(c)){let f=Ge(c);if(f){let[d,m]=f;i(r,{label:c,kind:lt.CompletionItemKind.Reference,detail:d==null?void 0:d.elementType,sortText:"1"})}}else if($p.includes(c)){let f=Ni(c);if(f){let[d]=f;i(r,{label:c,kind:lt.CompletionItemKind.Enum,detail:d==null?void 0:d.elementType,sortText:"1"})}}else i(r,{label:c,kind:lt.CompletionItemKind.Keyword,detail:"Keyword",sortText:"1"})})}}catch{}}handleStructOrFunctionBlockVarDecl(r,n,i,o,s){if(r!==""&&r)n(i,{label:o,kind:lt.CompletionItemKind.Reference,detail:r,sortText:"1"});else{let a=s.Identifier;a&&n(i,{label:o,kind:lt.CompletionItemKind.Reference,detail:a.$refText,sortText:"1"})}}completionForCrossReference(r,n,i){var s,a;let o=r.node;if(Yt(o)){let l=o.variable.$refText;ub(l).forEach(c=>{let f=Ge(c);if(f){let[d,m]=f;i(r,{label:d==null?void 0:d.elementName,kind:lt.CompletionItemKind.Reference,detail:d==null?void 0:d.usage,sortText:"1"})}})}else if(Tn(o)){let l=(a=(s=o.enumType)==null?void 0:s.$refText)!=null?a:"";return fb(l).forEach(c=>{let f=Ni(c);if(f){let[d]=f;i(r,{label:d==null?void 0:d.elementName,kind:lt.CompletionItemKind.Enum,detail:d==null?void 0:d.elementType,sortText:"1"})}}),super.completionForCrossReference(r,n,i)}else if(Ln(o)){let l=o.previous;if(Ln(l)){let u=l.element,c=u==null?void 0:u.ref;if(Bu(c)||At(c)){let f=c.typeName,d="";return d=Xe(d,f),d?void 0:super.completionForCrossReference(r,n,i)}}else if(Cn(l))return super.completionForCrossReference(r,n,i)}else return super.completionForCrossReference(r,n,i)}findFeaturesAt(r,n){let i=r.getText({start:lt.Position.create(0,0),end:r.positionAt(n)}),o=this.completionParser.parse(i),s=o.tokens;if(o.tokenIndex===0){let u=bt.getEntryRule(this.grammar),c=Mo({feature:u.definition,type:bt.getExplicitRuleType(u)});return s.length>0?(s.shift(),wl(c.map(f=>[f]),s)):c}let a=[...s].splice(o.tokenIndex);return this.findLocalNextFeatures([o.elementStack.map(u=>({feature:u}))],a)}findLocalNextFeatures(r,n){let i={stacks:r,tokens:n};return i.stacks.flat().forEach(s=>{s.property=void 0}),this.findNextFeatureStacks(i.stacks).map(s=>s[s.length-1])}findNextFeatureStacks(r,n){let i=[];for(let o of r)i.push(...this.interpretStackToken(o,n));return i}interpretStackToken(r,n){let i=new Map,o=new Set(r.map(a=>a.feature).filter(this.isPlusFeature)),s=[];for(;r.length>0;){let a=r.pop(),l=this.findNextFeaturesInternal({next:a,cardinalities:i,plus:o,visited:new Set}).filter(u=>n?this.featureMatches(u.feature,n):!0);for(let u of l)s.push([...r,u]);if(!l.every(u=>bt.isOptionalCardinality(u.feature.cardinality,u.feature)||bt.isOptionalCardinality(i.get(u.feature))))break}return s}isPlusFeature(r){if(r.cardinality==="+")return!0;let n=Qt.getContainerOfType(r,st.isAssignment);return!!(n&&n.cardinality==="+")}findNextFeaturesInternal(r){let{next:n,cardinalities:i,visited:o,plus:s}=r,a=[],l=n.feature;if(o.has(l))return[];o.add(l);let u,c=l;for(;c.$container;)if(st.isGroup(c.$container)){u=c.$container;break}else if(st.isAbstractElement(c.$container))c=c.$container;else break;if(bt.isArrayCardinality(c.cardinality)){let f=this.findFirstFeaturesInternal({next:{feature:c,type:n.type},cardinalities:i,visited:o,plus:s});for(let d of f)s.add(d.feature);a.push(...f)}if(u){let f=u.elements.indexOf(c);f!==void 0&&f<u.elements.length-1&&a.push(...this.findNextFeaturesInGroup({feature:u,type:n.type},f+1,i,o,s)),a.every(d=>bt.isOptionalCardinality(d.feature.cardinality,d.feature)||bt.isOptionalCardinality(i.get(d.feature))||s.has(d.feature))&&a.push(...this.findNextFeaturesInternal({next:{feature:u,type:n.type},cardinalities:i,visited:o,plus:s}))}return a}featureMatches(r,n){if(st.isKeyword(r))return r.value===n.image;if(st.isRuleCall(r))return this.ruleMatches(r.rule.ref,n);if(st.isCrossReference(r)){let i=bt.getCrossReferenceTerminal(r);if(i)return this.featureMatches(i,n)}return!1}findFirstFeaturesInternal(r){var u,c,f;let{next:n,cardinalities:i,visited:o,plus:s}=r;if(n===void 0)return[];let{feature:a,type:l}=n;if(st.isGroup(a)){if(o.has(a))return[];o.add(a)}if(st.isGroup(a))return this.findNextFeaturesInGroup(n,0,i,o,s).map(d=>this.modifyCardinality(d,a.cardinality,i));if(st.isAlternatives(a)||st.isUnorderedGroup(a))return a.elements.flatMap(d=>this.findFirstFeaturesInternal({next:{feature:d,type:l,property:n.property},cardinalities:i,visited:o,plus:s})).map(d=>this.modifyCardinality(d,a.cardinality,i));if(st.isAssignment(a)){let d={feature:a.terminal,type:l,property:(u=n.property)!=null?u:a.feature};return this.findFirstFeaturesInternal({next:d,cardinalities:i,visited:o,plus:s}).map(m=>this.modifyCardinality(m,a.cardinality,i))}else{if(st.isAction(a))return this.findNextFeaturesInternal({next:{feature:a,type:bt.getTypeName(a),property:(c=n.property)!=null?c:a.feature},cardinalities:i,visited:o,plus:s});if(st.isRuleCall(a)&&st.isParserRule(a.rule.ref)){let d=a.rule.ref,m={feature:d.definition,type:d.fragment||d.dataType?void 0:(f=bt.getExplicitRuleType(d))!=null?f:d.name,property:n.property};return this.findFirstFeaturesInternal({next:m,cardinalities:i,visited:o,plus:s}).map(_=>this.modifyCardinality(_,a.cardinality,i))}else return[n]}}findNextFeaturesInGroup(r,n,i,o,s){var u;let a=[],l;for(;n<r.feature.elements.length&&(l={feature:r.feature.elements[n++],type:r.type},a.push(...this.findFirstFeaturesInternal({next:l,cardinalities:i,visited:o,plus:s})),!!bt.isOptionalCardinality((u=l.feature.cardinality)!=null?u:i.get(l.feature),l.feature)););return a}ruleMatches(r,n){return st.isParserRule(r)?Mo(r.definition).some(o=>this.featureMatches(o.feature,n)):st.isTerminalRule(r)?bt.terminalRegex(r).test(n.image):!1}modifyCardinality(r,n,i){return i.set(r.feature,n),r}getDataType(r){let n=r.variables,i=r.nextVariables,o=r.typeName,s="";return s=Xe(s,o),{expectedType:s,variable:n,typeName:o,nextVariables:i}}};var Up=class extends Ya{constructor(r){super(r);this.services=r}getDocumentHighlight(r,n){let i=r.parseResult.value.$cstNode;if(!i)return;let o=Wi.findDeclarationNodeAtOffset(i,r.textDocument.offsetAt(n.position),this.grammarConfig.nameRegexp);if(!o)return;let s=this.references.findDeclaration(o);if(s){let a=[];if(s.$type==="VarDeclaration"||s.$type==="FunctionElement")return a;{let l=s.$document;if(!l)return a;let u=Vt.equals(l.uri,r.uri),c={documentUri:r.uri,includeDeclaration:u};return this.references.findReferences(s,c).map(d=>this.createDocumentHighlight(d)).toArray()}}}};var Vp=class extends Qo{constructor(r){super(r);this.services=r}findDeclaration(r){if(r){let n=bt.findAssignment(r),i=r.astNode;if(n&&i){let o=i[n.feature];if(Rt(o)){if(lb.includes(o.$refText.toUpperCase())){let s=Ge(o.$refText.toUpperCase());if(s){let[a,l]=s;return a}}return o.ref}else if(Array.isArray(o)){for(let s of o)if(Rt(s)&&s.$refNode&&s.$refNode.offset<=r.offset&&s.$refNode.end>=r.end)return s.ref}}if(i){let o=this.nameProvider.getNameNode(i);if(o&&(o===r||Wi.isChildNode(r,o)))return i}}}};var tl=yt(Or(),1);var Bp=class extends gp{getSignatureFromElement(e,r){var n,i,o,s,a;if(bp(e)){let l=e.$container;if(Cp(l)){let u=l.assignPrefix,c=u==null?void 0:u.varEnchanceDecl.$refText,f=u==null?void 0:u.varEnchanceDecl.ref;if(f){if(bn(f)){let m=f.varInputs,_=f.varOutputs,x=go(m),A=go(_),I=Math.max(x,A),y=f.name,g=f.variable_type,O="";O=Xe(O,g),O===void 0&&(O=(n=g.Identifier)==null?void 0:n.$refText);let M=[],J="";m.forEach(Ce=>{let j=Ce.items;for(let k=0;k<j.length;k++){let V=j[k],G=V.nextVariables,ie=mr(V.variables,I),z="",$=V.typeName;z=Xe(z,$),J+=`
VAR_INPUT${" ".repeat(8)}${V.variables}${" ".repeat(ie)}${z}`,G.length>0&&G.forEach(w=>{let le=mr(w,I);J+=`
VAR_INPUT${" ".repeat(8)}${w}${" ".repeat(le)}${z}`})}}),_.forEach(Ce=>{let j=Ce.items;for(let k=0;k<j.length;k++){let V=j[k],G=V.nextVariables,ie=mr(V.variables,I),z="",$=V.typeName;z=Xe(z,$),J+=`
VAR_OUTPUT${" ".repeat(7)}${V.variables}${" ".repeat(ie)}${z}`,G.length>0&&G.forEach(w=>{let le=mr(w,I);J+=`
VAR_OUTPUT${" ".repeat(7)}${w}${" ".repeat(le)}${z}`})}});let ce={kind:tl.MarkupKind.Markdown,value:["```typescript",J,"```"].join(`
`)},_e={label:`FUNCTION ${y}:${O}
`,documentation:ce};return M.push(_e),{signatures:M}}else if(At(f)){let _=f.typeName.Identifier;if(_){let A=_.ref;if(ei(A)){let I=A.varInputs,y=A.varOutputs,g=[],O="",M=go(I),J=go(y),ce=Math.max(M,J);I.forEach(j=>{let k=j.items;for(let V=0;V<k.length;V++){let G=k[V],ie=G.nextVariables,z=mr(G.variables,ce),$="",w=G.typeName;$=Xe($,w),O+=`
VAR_INPUT${" ".repeat(8)}${G.variables}${" ".repeat(z)}${$}`,ie.length>0&&ie.forEach(le=>{let he=mr(le,ce);O+=`
VAR_INPUT${" ".repeat(8)}${le}${" ".repeat(he)}${$}`})}}),y.forEach(j=>{let k=j.items;for(let V=0;V<k.length;V++){let G=k[V],ie=G.nextVariables,z=mr(G.variables,ce),$="",w=G.typeName;$=Xe($,w),O+=`
VAR_OUTPUT${" ".repeat(7)}${G.variables}${" ".repeat(z)}${$}`,ie.length>0&&ie.forEach(le=>{let he=mr(le,ce);O+=`
VAR_OUTPUT${" ".repeat(7)}${le}${" ".repeat(he)}${$}`})}});let _e={kind:tl.MarkupKind.Markdown,value:["```typescript",O,"```"].join(`
`)},je={label:`FUNCTION_BLOCK ${A.name}
`,documentation:_e};return g.push(je),{signatures:g}}}let x=this.getCacheSignatureHelp(this.getVarDeclarationCacheName(f));if(x)return x}}let d=this.getCacheSignatureHelp(c);if(d)return d}else if(fo(l)){let u=l.refFunctionName,c=(i=u.refFunctionName)==null?void 0:i.ref,f=(s=(o=u.refFunctionName)==null?void 0:o.$refText)!=null?s:u.Cache_type_name;if(c){if(bn(c)){let m=c.varInputs,_=c.varOutputs,x=go(m),A=go(_),I=Math.max(x,A),y=c.name,g=c.variable_type,O="";O=Xe(O,g),O===void 0&&(O=(a=g.Identifier)==null?void 0:a.$refText);let M=[],J="";m.forEach(Ce=>{let j=Ce.items;for(let k=0;k<j.length;k++){let V=j[k],G=V.nextVariables,ie=mr(V.variables,I),z="",$=V.typeName;z=Xe(z,$),J+=`
VAR_INPUT${" ".repeat(8)}${V.variables}${" ".repeat(ie)}${z}`,G.length>0&&G.forEach(w=>{let le=mr(w,I);J+=`
VAR_INPUT${" ".repeat(8)}${w}${" ".repeat(le)}${z}`})}}),_.forEach(Ce=>{let j=Ce.items;for(let k=0;k<j.length;k++){let V=j[k],G=V.nextVariables,ie=mr(V.variables,I),z="",$=V.typeName;z=Xe(z,$),J+=`
VAR_OUTPUT${" ".repeat(7)}${V.variables}${" ".repeat(ie)}${z}`,G.length>0&&G.forEach(w=>{let le=mr(w,I);J+=`
VAR_OUTPUT${" ".repeat(7)}${w}${" ".repeat(le)}${z}`})}});let ce={kind:tl.MarkupKind.Markdown,value:["```typescript",J,"```"].join(`
`)},_e={label:`FUNCTION ${y}:${O}
`,documentation:ce};return M.push(_e),{signatures:M}}else if(At(c)){let _=c.typeName.Identifier;if(_){let A=_.ref;if(ei(A)){let I=A.varInputs,y=A.varOutputs,g=[],O="",M=go(I),J=go(y),ce=Math.max(M,J);I.forEach(j=>{let k=j.items;for(let V=0;V<k.length;V++){let G=k[V],ie=G.nextVariables,z=mr(G.variables,ce),$="",w=G.typeName;$=Xe($,w),O+=`
VAR_INPUT${" ".repeat(8)}${G.variables}${" ".repeat(z)}${$}`,ie.length>0&&ie.forEach(le=>{let he=mr(le,ce);O+=`
VAR_INPUT${" ".repeat(8)}${le}${" ".repeat(he)}${$}`})}}),y.forEach(j=>{let k=j.items;for(let V=0;V<k.length;V++){let G=k[V],ie=G.nextVariables,z=mr(G.variables,ce),$="",w=G.typeName;$=Xe($,w),O+=`
VAR_OUTPUT${" ".repeat(7)}${G.variables}${" ".repeat(z)}${$}`,ie.length>0&&ie.forEach(le=>{let he=mr(le,ce);O+=`
VAR_OUTPUT${" ".repeat(7)}${le}${" ".repeat(he)}${$}`})}});let _e={kind:tl.MarkupKind.Markdown,value:["```typescript",O,"```"].join(`
`)},je={label:`FUNCTION_BLOCK ${A.name}
`,documentation:_e};return g.push(je),{signatures:g}}}let x=this.getCacheSignatureHelp(this.getVarDeclarationCacheName(c));if(x)return x}}let d=this.getCacheSignatureHelp(f);if(d)return d}}}getVarDeclarationCacheName(e){var n;let r=e.typeName;return r.Cache_type_name?r.Cache_type_name:(n=r.Identifier)==null?void 0:n.$refText}getCacheSignatureHelp(e){if(!e)return;let r=Ge(e);if(r){let[n]=r,i=[];if(n){let o=this.getSignatureInfo(n,i,"usage");return o||this.getSignatureInfo(n,i,"comment")}}}get signatureHelpOptions(){return{triggerCharacters:["(",","],retriggerCharacters:[","]}}getSignatureInfo(e,r,n){let i=e[n],o=JG(e.varDecls),s="",a=QG(o);if(o.forEach(l=>{let u=mr(l.variable,a),c=l.varType==="VAR_INPUT"?8:7;s+=`
${l.varType}${" ".repeat(c)}${l.variable}${" ".repeat(u)} ${l.type}`}),i){let l=e.elementType==="functionBlock"?"FUNCTION_BLOCK":"FUNCTION",u=e.elementType==="functionBlock"?"\u529F\u80FD\u5757\u8BF4\u660E: ":"\u51FD\u6570\u8BF4\u660E: ",c={kind:tl.MarkupKind.Markdown,value:["```typescript",`${u}${e.comment}`,s,"```"].join(`
`)},f={label:`${l} ${e.elementName}
`,documentation:c};return r.push(f),{signatures:r}}}},y_=class{constructor(e,r,n){this.varType=e;this.variable=r;this.type=n}};function JG(t){let e=[];return t.forEach(r=>{let n=r.varGlobalType,i=r.varName,o=r.varType,s=new y_(n,i,o);e.push(s)}),e}function mr(t,e){let r=8,n=t.length;return e+r-n}function go(t){let e=0;return t.forEach(r=>{r.items.forEach(n=>{let i=n.nextVariables;e=Math.max(e,n.variables.length),i.length>0&&i.forEach(o=>{e=Math.max(e,o.length)})})}),e}function QG(t){let e=0;return t.forEach(r=>{e=Math.max(e,r.variable.length)}),e}var Wp,gb=()=>Wp!=null?Wp:Wp=Op(`{
  "$type": "Grammar",
  "isDeclared": true,
  "name": "St",
  "rules": [
    {
      "$type": "ParserRule",
      "name": "St",
      "entry": true,
      "definition": {
        "$type": "Alternatives",
        "elements": [
          {
            "$type": "Assignment",
            "feature": "globalVarLists",
            "operator": "+=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@1"
              },
              "arguments": []
            }
          },
          {
            "$type": "Assignment",
            "feature": "program",
            "operator": "+=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@3"
              },
              "arguments": []
            }
          },
          {
            "$type": "Assignment",
            "feature": "types_alias",
            "operator": "+=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@22"
              },
              "arguments": []
            }
          },
          {
            "$type": "Assignment",
            "feature": "types_union",
            "operator": "+=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@21"
              },
              "arguments": []
            }
          },
          {
            "$type": "Assignment",
            "feature": "types_struct",
            "operator": "+=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@18"
              },
              "arguments": []
            }
          },
          {
            "$type": "Assignment",
            "feature": "types_enum",
            "operator": "+=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@23"
              },
              "arguments": []
            }
          },
          {
            "$type": "Assignment",
            "feature": "function_block",
            "operator": "+=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@11"
              },
              "arguments": []
            }
          },
          {
            "$type": "Assignment",
            "feature": "st_function",
            "operator": "+=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@4"
              },
              "arguments": []
            }
          },
          {
            "$type": "Assignment",
            "feature": "itface",
            "operator": "+=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@6"
              },
              "arguments": []
            }
          }
        ],
        "cardinality": "*"
      },
      "definesHiddenTokens": false,
      "fragment": false,
      "hiddenTokens": [],
      "parameters": [],
      "wildcard": false
    },
    {
      "$type": "ParserRule",
      "name": "GlobalVarList",
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "Assignment",
            "feature": "attributes",
            "operator": "+=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@2"
              },
              "arguments": []
            },
            "cardinality": "*"
          },
          {
            "$type": "Keyword",
            "value": "VAR_GLOBAL"
          },
          {
            "$type": "Assignment",
            "feature": "modifiers",
            "operator": "+=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@26"
              },
              "arguments": []
            },
            "cardinality": "*"
          },
          {
            "$type": "Assignment",
            "feature": "items",
            "operator": "+=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@20"
              },
              "arguments": []
            },
            "cardinality": "*"
          },
          {
            "$type": "Keyword",
            "value": "END_VAR"
          }
        ]
      },
      "definesHiddenTokens": false,
      "entry": false,
      "fragment": false,
      "hiddenTokens": [],
      "parameters": [],
      "wildcard": false
    },
    {
      "$type": "ParserRule",
      "name": "AttributePragma",
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "Keyword",
            "value": "{"
          },
          {
            "$type": "Keyword",
            "value": "attribute"
          },
          {
            "$type": "Assignment",
            "feature": "attributeName",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@39"
              },
              "arguments": []
            }
          },
          {
            "$type": "Keyword",
            "value": "}"
          }
        ]
      },
      "definesHiddenTokens": false,
      "entry": false,
      "fragment": false,
      "hiddenTokens": [],
      "parameters": [],
      "wildcard": false
    },
    {
      "$type": "ParserRule",
      "name": "Program",
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "Keyword",
            "value": "PROGRAM"
          },
          {
            "$type": "Assignment",
            "feature": "name",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@9"
              },
              "arguments": []
            }
          },
          {
            "$type": "Alternatives",
            "elements": [
              {
                "$type": "Assignment",
                "feature": "inputs",
                "operator": "+=",
                "terminal": {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@13"
                  },
                  "arguments": []
                }
              },
              {
                "$type": "Assignment",
                "feature": "varExternals",
                "operator": "+=",
                "terminal": {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@17"
                  },
                  "arguments": []
                }
              }
            ],
            "cardinality": "*"
          },
          {
            "$type": "Assignment",
            "feature": "stStatements",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@77"
              },
              "arguments": []
            },
            "cardinality": "?"
          },
          {
            "$type": "Keyword",
            "value": "END_PROGRAM"
          }
        ]
      },
      "definesHiddenTokens": false,
      "entry": false,
      "fragment": false,
      "hiddenTokens": [],
      "parameters": [],
      "wildcard": false
    },
    {
      "$type": "ParserRule",
      "name": "StFunction",
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "Keyword",
            "value": "FUNCTION"
          },
          {
            "$type": "Assignment",
            "feature": "name",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@119"
              },
              "arguments": []
            }
          },
          {
            "$type": "Keyword",
            "value": ":"
          },
          {
            "$type": "Assignment",
            "feature": "variable_type",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@29"
              },
              "arguments": []
            }
          },
          {
            "$type": "Alternatives",
            "elements": [
              {
                "$type": "Assignment",
                "feature": "varInputs",
                "operator": "+=",
                "terminal": {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@14"
                  },
                  "arguments": []
                }
              },
              {
                "$type": "Assignment",
                "feature": "varOutputs",
                "operator": "+=",
                "terminal": {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@15"
                  },
                  "arguments": []
                }
              },
              {
                "$type": "Assignment",
                "feature": "varLocals",
                "operator": "+=",
                "terminal": {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@16"
                  },
                  "arguments": []
                }
              }
            ],
            "cardinality": "*"
          },
          {
            "$type": "Assignment",
            "feature": "statementList",
            "operator": "+=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@78"
              },
              "arguments": []
            },
            "cardinality": "*"
          },
          {
            "$type": "Keyword",
            "value": "END_FUNCTION"
          }
        ]
      },
      "definesHiddenTokens": false,
      "entry": false,
      "fragment": false,
      "hiddenTokens": [],
      "parameters": [],
      "wildcard": false
    },
    {
      "$type": "ParserRule",
      "name": "ReqParams",
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "Assignment",
            "feature": "param",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@119"
              },
              "arguments": []
            }
          },
          {
            "$type": "Keyword",
            "value": ":"
          },
          {
            "$type": "Assignment",
            "feature": "typeName",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@29"
              },
              "arguments": []
            }
          }
        ]
      },
      "definesHiddenTokens": false,
      "entry": false,
      "fragment": false,
      "hiddenTokens": [],
      "parameters": [],
      "wildcard": false
    },
    {
      "$type": "ParserRule",
      "name": "Interface",
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "Keyword",
            "value": "INTERFACE"
          },
          {
            "$type": "Assignment",
            "feature": "name",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@9"
              },
              "arguments": []
            }
          },
          {
            "$type": "Group",
            "elements": [
              {
                "$type": "Keyword",
                "value": "EXTENDS"
              },
              {
                "$type": "Assignment",
                "feature": "extender",
                "operator": "=",
                "terminal": {
                  "$type": "CrossReference",
                  "type": {
                    "$ref": "#/rules@6"
                  },
                  "terminal": {
                    "$type": "RuleCall",
                    "rule": {
                      "$ref": "#/rules@9"
                    },
                    "arguments": []
                  },
                  "deprecatedSyntax": false
                }
              }
            ],
            "cardinality": "?"
          },
          {
            "$type": "Assignment",
            "feature": "methods",
            "operator": "+=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@7"
              },
              "arguments": []
            },
            "cardinality": "*"
          },
          {
            "$type": "Keyword",
            "value": "END_INTERFACE"
          }
        ]
      },
      "definesHiddenTokens": false,
      "entry": false,
      "fragment": false,
      "hiddenTokens": [],
      "parameters": [],
      "wildcard": false
    },
    {
      "$type": "ParserRule",
      "name": "Methods",
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "Keyword",
            "value": "METHOD"
          },
          {
            "$type": "Assignment",
            "feature": "modifier",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@8"
              },
              "arguments": []
            },
            "cardinality": "?"
          },
          {
            "$type": "Assignment",
            "feature": "name",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@9"
              },
              "arguments": []
            }
          },
          {
            "$type": "Group",
            "elements": [
              {
                "$type": "Keyword",
                "value": "("
              },
              {
                "$type": "Group",
                "elements": [
                  {
                    "$type": "Assignment",
                    "feature": "reqParams",
                    "operator": "+=",
                    "terminal": {
                      "$type": "RuleCall",
                      "rule": {
                        "$ref": "#/rules@5"
                      },
                      "arguments": []
                    }
                  },
                  {
                    "$type": "Keyword",
                    "value": ",",
                    "cardinality": "?"
                  }
                ],
                "cardinality": "*"
              },
              {
                "$type": "Keyword",
                "value": ")"
              }
            ],
            "cardinality": "?"
          },
          {
            "$type": "Keyword",
            "value": ":"
          },
          {
            "$type": "Assignment",
            "feature": "variable_type",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@29"
              },
              "arguments": []
            }
          },
          {
            "$type": "Assignment",
            "feature": "inputs",
            "operator": "+=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@12"
              },
              "arguments": []
            }
          },
          {
            "$type": "Assignment",
            "feature": "statementList",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@77"
              },
              "arguments": []
            }
          },
          {
            "$type": "Keyword",
            "value": "END_METHOD"
          }
        ]
      },
      "definesHiddenTokens": false,
      "entry": false,
      "fragment": false,
      "hiddenTokens": [],
      "parameters": [],
      "wildcard": false
    },
    {
      "$type": "ParserRule",
      "name": "MethodModifier",
      "dataType": "string",
      "definition": {
        "$type": "Alternatives",
        "elements": [
          {
            "$type": "Keyword",
            "value": "PRIVATE"
          },
          {
            "$type": "Keyword",
            "value": "PUBLIC"
          },
          {
            "$type": "Keyword",
            "value": "PROTECTED"
          },
          {
            "$type": "Keyword",
            "value": "INTERNAL"
          }
        ]
      },
      "definesHiddenTokens": false,
      "entry": false,
      "fragment": false,
      "hiddenTokens": [],
      "parameters": [],
      "wildcard": false
    },
    {
      "$type": "ParserRule",
      "name": "VarEnchanceDecl",
      "dataType": "string",
      "definition": {
        "$type": "Alternatives",
        "elements": [
          {
            "$type": "RuleCall",
            "rule": {
              "$ref": "#/rules@119"
            },
            "arguments": []
          },
          {
            "$type": "RuleCall",
            "rule": {
              "$ref": "#/rules@10"
            },
            "arguments": []
          }
        ]
      },
      "definesHiddenTokens": false,
      "entry": false,
      "fragment": false,
      "hiddenTokens": [],
      "parameters": [],
      "wildcard": false
    },
    {
      "$type": "ParserRule",
      "name": "OuterName",
      "dataType": "string",
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "Alternatives",
            "elements": [
              {
                "$type": "RuleCall",
                "rule": {
                  "$ref": "#/rules@107"
                },
                "arguments": []
              },
              {
                "$type": "RuleCall",
                "rule": {
                  "$ref": "#/rules@116"
                },
                "arguments": []
              },
              {
                "$type": "RuleCall",
                "rule": {
                  "$ref": "#/rules@117"
                },
                "arguments": []
              },
              {
                "$type": "RuleCall",
                "rule": {
                  "$ref": "#/rules@111"
                },
                "arguments": []
              }
            ]
          },
          {
            "$type": "Alternatives",
            "elements": [
              {
                "$type": "RuleCall",
                "rule": {
                  "$ref": "#/rules@140"
                },
                "arguments": []
              },
              {
                "$type": "RuleCall",
                "rule": {
                  "$ref": "#/rules@119"
                },
                "arguments": []
              }
            ],
            "cardinality": "?"
          }
        ]
      },
      "definesHiddenTokens": false,
      "entry": false,
      "fragment": false,
      "hiddenTokens": [],
      "parameters": [],
      "wildcard": false
    },
    {
      "$type": "ParserRule",
      "name": "FunctionBlock",
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "Keyword",
            "value": "FUNCTION_BLOCK"
          },
          {
            "$type": "Alternatives",
            "elements": [
              {
                "$type": "Keyword",
                "value": "PUBLIC"
              },
              {
                "$type": "Keyword",
                "value": "INTERNAL"
              }
            ],
            "cardinality": "?"
          },
          {
            "$type": "Keyword",
            "value": "FINAL",
            "cardinality": "?"
          },
          {
            "$type": "Assignment",
            "feature": "name",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@119"
              },
              "arguments": []
            }
          },
          {
            "$type": "Alternatives",
            "elements": [
              {
                "$type": "Assignment",
                "feature": "varInputs",
                "operator": "+=",
                "terminal": {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@14"
                  },
                  "arguments": []
                }
              },
              {
                "$type": "Assignment",
                "feature": "varOutputs",
                "operator": "+=",
                "terminal": {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@15"
                  },
                  "arguments": []
                }
              },
              {
                "$type": "Assignment",
                "feature": "varLocals",
                "operator": "+=",
                "terminal": {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@16"
                  },
                  "arguments": []
                }
              },
              {
                "$type": "Assignment",
                "feature": "varExternals",
                "operator": "+=",
                "terminal": {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@17"
                  },
                  "arguments": []
                }
              }
            ],
            "cardinality": "*"
          },
          {
            "$type": "Assignment",
            "feature": "methods",
            "operator": "+=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@7"
              },
              "arguments": []
            },
            "cardinality": "*"
          },
          {
            "$type": "Assignment",
            "feature": "statementList",
            "operator": "+=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@78"
              },
              "arguments": []
            },
            "cardinality": "*"
          },
          {
            "$type": "Keyword",
            "value": "END_FUNCTION_BLOCK"
          }
        ]
      },
      "definesHiddenTokens": false,
      "entry": false,
      "fragment": false,
      "hiddenTokens": [],
      "parameters": [],
      "wildcard": false
    },
    {
      "$type": "ParserRule",
      "name": "Inputs_List",
      "inferredType": {
        "$type": "InferredType",
        "name": "InputsList"
      },
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "Assignment",
            "feature": "definition",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@25"
              },
              "arguments": []
            }
          },
          {
            "$type": "Assignment",
            "feature": "modifiers",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@26"
              },
              "arguments": []
            },
            "cardinality": "*"
          },
          {
            "$type": "Assignment",
            "feature": "items",
            "operator": "+=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@20"
              },
              "arguments": []
            },
            "cardinality": "*"
          },
          {
            "$type": "Keyword",
            "value": "END_VAR"
          }
        ],
        "cardinality": "*"
      },
      "definesHiddenTokens": false,
      "entry": false,
      "fragment": false,
      "hiddenTokens": [],
      "parameters": [],
      "wildcard": false
    },
    {
      "$type": "ParserRule",
      "name": "Inputs_List_single",
      "inferredType": {
        "$type": "InferredType",
        "name": "InputsListSingle"
      },
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "Assignment",
            "feature": "definition",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@25"
              },
              "arguments": []
            }
          },
          {
            "$type": "Assignment",
            "feature": "modifiers",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@26"
              },
              "arguments": []
            },
            "cardinality": "*"
          },
          {
            "$type": "Assignment",
            "feature": "items",
            "operator": "+=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@20"
              },
              "arguments": []
            },
            "cardinality": "*"
          },
          {
            "$type": "Keyword",
            "value": "END_VAR"
          }
        ]
      },
      "definesHiddenTokens": false,
      "entry": false,
      "fragment": false,
      "hiddenTokens": [],
      "parameters": [],
      "wildcard": false
    },
    {
      "$type": "ParserRule",
      "name": "VarInput",
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "Keyword",
            "value": "VAR_INPUT"
          },
          {
            "$type": "Assignment",
            "feature": "items",
            "operator": "+=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@20"
              },
              "arguments": []
            },
            "cardinality": "*"
          },
          {
            "$type": "Keyword",
            "value": "END_VAR"
          }
        ]
      },
      "definesHiddenTokens": false,
      "entry": false,
      "fragment": false,
      "hiddenTokens": [],
      "parameters": [],
      "wildcard": false
    },
    {
      "$type": "ParserRule",
      "name": "VarOutput",
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "Keyword",
            "value": "VAR_OUTPUT"
          },
          {
            "$type": "Assignment",
            "feature": "items",
            "operator": "+=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@20"
              },
              "arguments": []
            },
            "cardinality": "*"
          },
          {
            "$type": "Keyword",
            "value": "END_VAR"
          }
        ]
      },
      "definesHiddenTokens": false,
      "entry": false,
      "fragment": false,
      "hiddenTokens": [],
      "parameters": [],
      "wildcard": false
    },
    {
      "$type": "ParserRule",
      "name": "VarLocal",
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "Keyword",
            "value": "VAR"
          },
          {
            "$type": "Assignment",
            "feature": "items",
            "operator": "+=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@20"
              },
              "arguments": []
            },
            "cardinality": "*"
          },
          {
            "$type": "Keyword",
            "value": "END_VAR"
          }
        ]
      },
      "definesHiddenTokens": false,
      "entry": false,
      "fragment": false,
      "hiddenTokens": [],
      "parameters": [],
      "wildcard": false
    },
    {
      "$type": "ParserRule",
      "name": "VarExternal",
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "Keyword",
            "value": "VAR_EXTERNAL"
          },
          {
            "$type": "Assignment",
            "feature": "items",
            "operator": "+=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@20"
              },
              "arguments": []
            },
            "cardinality": "*"
          },
          {
            "$type": "Keyword",
            "value": "END_VAR"
          }
        ]
      },
      "definesHiddenTokens": false,
      "entry": false,
      "fragment": false,
      "hiddenTokens": [],
      "parameters": [],
      "wildcard": false
    },
    {
      "$type": "ParserRule",
      "name": "Structs_List",
      "inferredType": {
        "$type": "InferredType",
        "name": "StructsList"
      },
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "Keyword",
            "value": "TYPE"
          },
          {
            "$type": "Assignment",
            "feature": "name",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@119"
              },
              "arguments": []
            }
          },
          {
            "$type": "Keyword",
            "value": ":"
          },
          {
            "$type": "Keyword",
            "value": "STRUCT"
          },
          {
            "$type": "Assignment",
            "feature": "items",
            "operator": "+=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@19"
              },
              "arguments": []
            },
            "cardinality": "*"
          },
          {
            "$type": "Keyword",
            "value": "END_STRUCT"
          },
          {
            "$type": "Keyword",
            "value": "END_TYPE"
          }
        ]
      },
      "definesHiddenTokens": false,
      "entry": false,
      "fragment": false,
      "hiddenTokens": [],
      "parameters": [],
      "wildcard": false
    },
    {
      "$type": "ParserRule",
      "name": "Struct_Var_Decl_Init",
      "returnType": {
        "$ref": "#/types@2"
      },
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "Action",
            "inferredType": {
              "$type": "InferredType",
              "name": "Struct_Var_Decl_Init"
            }
          },
          {
            "$type": "Assignment",
            "feature": "variables",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@9"
              },
              "arguments": []
            }
          },
          {
            "$type": "Group",
            "elements": [
              {
                "$type": "Keyword",
                "value": ","
              },
              {
                "$type": "Assignment",
                "feature": "nextVariables",
                "operator": "+=",
                "terminal": {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@9"
                  },
                  "arguments": []
                }
              }
            ],
            "cardinality": "*"
          },
          {
            "$type": "Group",
            "elements": [
              {
                "$type": "Keyword",
                "value": "AT"
              },
              {
                "$type": "RuleCall",
                "rule": {
                  "$ref": "#/rules@139"
                },
                "arguments": []
              }
            ],
            "cardinality": "?"
          },
          {
            "$type": "Keyword",
            "value": ":"
          },
          {
            "$type": "Assignment",
            "feature": "typeName",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@29"
              },
              "arguments": []
            }
          },
          {
            "$type": "Group",
            "elements": [
              {
                "$type": "Keyword",
                "value": ":="
              },
              {
                "$type": "Assignment",
                "feature": "initialValue",
                "operator": "=",
                "terminal": {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@30"
                  },
                  "arguments": []
                }
              }
            ],
            "cardinality": "?"
          },
          {
            "$type": "Keyword",
            "value": ";"
          }
        ]
      },
      "definesHiddenTokens": false,
      "entry": false,
      "fragment": false,
      "hiddenTokens": [],
      "parameters": [],
      "wildcard": false
    },
    {
      "$type": "ParserRule",
      "name": "Var_Decl_Init",
      "inferredType": {
        "$type": "InferredType",
        "name": "VarDeclarationInit"
      },
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "Assignment",
            "feature": "variables",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@9"
              },
              "arguments": []
            }
          },
          {
            "$type": "Group",
            "elements": [
              {
                "$type": "Keyword",
                "value": ","
              },
              {
                "$type": "Assignment",
                "feature": "nextVariables",
                "operator": "+=",
                "terminal": {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@9"
                  },
                  "arguments": []
                }
              }
            ],
            "cardinality": "*"
          },
          {
            "$type": "Group",
            "elements": [
              {
                "$type": "Keyword",
                "value": "AT"
              },
              {
                "$type": "RuleCall",
                "rule": {
                  "$ref": "#/rules@139"
                },
                "arguments": []
              }
            ],
            "cardinality": "?"
          },
          {
            "$type": "Keyword",
            "value": ":"
          },
          {
            "$type": "Assignment",
            "feature": "typeName",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@29"
              },
              "arguments": []
            }
          },
          {
            "$type": "Group",
            "elements": [
              {
                "$type": "Keyword",
                "value": ":="
              },
              {
                "$type": "Assignment",
                "feature": "initialValue",
                "operator": "=",
                "terminal": {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@30"
                  },
                  "arguments": []
                }
              }
            ],
            "cardinality": "?"
          },
          {
            "$type": "Keyword",
            "value": ";"
          }
        ]
      },
      "definesHiddenTokens": false,
      "entry": false,
      "fragment": false,
      "hiddenTokens": [],
      "parameters": [],
      "wildcard": false
    },
    {
      "$type": "ParserRule",
      "name": "Unions_List",
      "inferredType": {
        "$type": "InferredType",
        "name": "UnionsList"
      },
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "Keyword",
            "value": "TYPE"
          },
          {
            "$type": "Assignment",
            "feature": "name",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@9"
              },
              "arguments": []
            }
          },
          {
            "$type": "Keyword",
            "value": ":"
          },
          {
            "$type": "Keyword",
            "value": "UNION"
          },
          {
            "$type": "Assignment",
            "feature": "items",
            "operator": "+=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@20"
              },
              "arguments": []
            },
            "cardinality": "*"
          },
          {
            "$type": "Keyword",
            "value": "END_UNION"
          },
          {
            "$type": "Keyword",
            "value": "END_TYPE"
          }
        ]
      },
      "definesHiddenTokens": false,
      "entry": false,
      "fragment": false,
      "hiddenTokens": [],
      "parameters": [],
      "wildcard": false
    },
    {
      "$type": "ParserRule",
      "name": "Alias",
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "Keyword",
            "value": "TYPE"
          },
          {
            "$type": "Assignment",
            "feature": "name",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@119"
              },
              "arguments": []
            }
          },
          {
            "$type": "Keyword",
            "value": ":"
          },
          {
            "$type": "Assignment",
            "feature": "refName",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@29"
              },
              "arguments": []
            }
          },
          {
            "$type": "Group",
            "elements": [
              {
                "$type": "Keyword",
                "value": ":="
              },
              {
                "$type": "Assignment",
                "feature": "initialValue",
                "operator": "=",
                "terminal": {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@30"
                  },
                  "arguments": []
                }
              }
            ],
            "cardinality": "?"
          },
          {
            "$type": "Keyword",
            "value": ";"
          },
          {
            "$type": "Keyword",
            "value": "END_TYPE"
          }
        ]
      },
      "definesHiddenTokens": false,
      "entry": false,
      "fragment": false,
      "hiddenTokens": [],
      "parameters": [],
      "wildcard": false
    },
    {
      "$type": "ParserRule",
      "name": "StEnum",
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "Keyword",
            "value": "TYPE"
          },
          {
            "$type": "Assignment",
            "feature": "name",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@9"
              },
              "arguments": []
            }
          },
          {
            "$type": "Keyword",
            "value": ":"
          },
          {
            "$type": "Keyword",
            "value": "("
          },
          {
            "$type": "Assignment",
            "feature": "enum",
            "operator": "+=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@24"
              },
              "arguments": []
            }
          },
          {
            "$type": "Group",
            "elements": [
              {
                "$type": "Keyword",
                "value": ","
              },
              {
                "$type": "Assignment",
                "feature": "enum",
                "operator": "+=",
                "terminal": {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@24"
                  },
                  "arguments": []
                }
              }
            ],
            "cardinality": "*"
          },
          {
            "$type": "Keyword",
            "value": ")"
          },
          {
            "$type": "Keyword",
            "value": "END_TYPE"
          }
        ]
      },
      "definesHiddenTokens": false,
      "entry": false,
      "fragment": false,
      "hiddenTokens": [],
      "parameters": [],
      "wildcard": false
    },
    {
      "$type": "ParserRule",
      "name": "Enum",
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "Assignment",
            "feature": "variable_name",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@9"
              },
              "arguments": []
            }
          },
          {
            "$type": "Group",
            "elements": [
              {
                "$type": "Keyword",
                "value": ":="
              },
              {
                "$type": "Assignment",
                "feature": "assignValue",
                "operator": "=",
                "terminal": {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@140"
                  },
                  "arguments": []
                }
              }
            ],
            "cardinality": "?"
          }
        ]
      },
      "definesHiddenTokens": false,
      "entry": false,
      "fragment": false,
      "hiddenTokens": [],
      "parameters": [],
      "wildcard": false
    },
    {
      "$type": "ParserRule",
      "name": "DefinitionKeyword",
      "dataType": "string",
      "definition": {
        "$type": "Alternatives",
        "elements": [
          {
            "$type": "Keyword",
            "value": "VAR"
          },
          {
            "$type": "Keyword",
            "value": "VAR_INPUT"
          },
          {
            "$type": "Keyword",
            "value": "VAR_OUTPUT"
          },
          {
            "$type": "Keyword",
            "value": "VAR_IN_OUT"
          },
          {
            "$type": "Keyword",
            "value": "VAR_TEMP"
          },
          {
            "$type": "Keyword",
            "value": "VAR_EXTERNAL"
          },
          {
            "$type": "Keyword",
            "value": "VAR_GLOBAL"
          }
        ]
      },
      "definesHiddenTokens": false,
      "entry": false,
      "fragment": false,
      "hiddenTokens": [],
      "parameters": [],
      "wildcard": false
    },
    {
      "$type": "ParserRule",
      "name": "Modifier",
      "dataType": "string",
      "definition": {
        "$type": "Alternatives",
        "elements": [
          {
            "$type": "Keyword",
            "value": "CONSTANT"
          },
          {
            "$type": "Keyword",
            "value": "RETAIN"
          },
          {
            "$type": "Keyword",
            "value": "NON_RETAIN"
          }
        ]
      },
      "definesHiddenTokens": false,
      "entry": false,
      "fragment": false,
      "hiddenTokens": [],
      "parameters": [],
      "wildcard": false
    },
    {
      "$type": "ParserRule",
      "name": "ComposeElement",
      "definition": {
        "$type": "Alternatives",
        "elements": [
          {
            "$type": "RuleCall",
            "rule": {
              "$ref": "#/rules@18"
            },
            "arguments": []
          },
          {
            "$type": "RuleCall",
            "rule": {
              "$ref": "#/rules@11"
            },
            "arguments": []
          },
          {
            "$type": "RuleCall",
            "rule": {
              "$ref": "#/rules@4"
            },
            "arguments": []
          },
          {
            "$type": "RuleCall",
            "rule": {
              "$ref": "#/rules@22"
            },
            "arguments": []
          },
          {
            "$type": "RuleCall",
            "rule": {
              "$ref": "#/rules@23"
            },
            "arguments": []
          }
        ]
      },
      "definesHiddenTokens": false,
      "entry": false,
      "fragment": false,
      "hiddenTokens": [],
      "parameters": [],
      "wildcard": false
    },
    {
      "$type": "ParserRule",
      "name": "Variable_Primary",
      "inferredType": {
        "$type": "InferredType",
        "name": "PrimaryVariable"
      },
      "definition": {
        "$type": "Assignment",
        "feature": "name",
        "operator": "=",
        "terminal": {
          "$type": "RuleCall",
          "rule": {
            "$ref": "#/rules@119"
          },
          "arguments": []
        }
      },
      "definesHiddenTokens": false,
      "entry": false,
      "fragment": false,
      "hiddenTokens": [],
      "parameters": [],
      "wildcard": false
    },
    {
      "$type": "ParserRule",
      "name": "Native_Type_Name",
      "definition": {
        "$type": "Alternatives",
        "elements": [
          {
            "$type": "Assignment",
            "feature": "Integer_type_name",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@106"
              },
              "arguments": []
            }
          },
          {
            "$type": "Assignment",
            "feature": "Unsigned_integer_type_name",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@109"
              },
              "arguments": []
            }
          },
          {
            "$type": "Assignment",
            "feature": "Bool_type_name",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@112"
              },
              "arguments": []
            }
          },
          {
            "$type": "Assignment",
            "feature": "String_type_name",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@113"
              },
              "arguments": []
            }
          },
          {
            "$type": "Assignment",
            "feature": "Bit_string_type_name",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@110"
              },
              "arguments": []
            }
          },
          {
            "$type": "Assignment",
            "feature": "Real_type_name",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@108"
              },
              "arguments": []
            }
          },
          {
            "$type": "Assignment",
            "feature": "Time_type_name",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@116"
              },
              "arguments": []
            }
          },
          {
            "$type": "Assignment",
            "feature": "Date_type_name",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@117"
              },
              "arguments": []
            }
          },
          {
            "$type": "Assignment",
            "feature": "Date_And_time_type_name",
            "operator": "=",
            "terminal": {
              "$type": "Alternatives",
              "elements": [
                {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@114"
                  },
                  "arguments": []
                },
                {
                  "$type": "Keyword",
                  "value": "DT"
                }
              ]
            }
          },
          {
            "$type": "Assignment",
            "feature": "Time_Of_Day_type_name",
            "operator": "=",
            "terminal": {
              "$type": "Alternatives",
              "elements": [
                {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@115"
                  },
                  "arguments": []
                },
                {
                  "$type": "Keyword",
                  "value": "TOD"
                }
              ]
            }
          },
          {
            "$type": "Assignment",
            "feature": "Any_type_name",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@118"
              },
              "arguments": []
            }
          },
          {
            "$type": "RuleCall",
            "rule": {
              "$ref": "#/rules@42"
            },
            "arguments": []
          },
          {
            "$type": "Assignment",
            "feature": "Identifier",
            "operator": "=",
            "terminal": {
              "$type": "CrossReference",
              "type": {
                "$ref": "#/rules@27"
              },
              "terminal": {
                "$type": "RuleCall",
                "rule": {
                  "$ref": "#/rules@119"
                },
                "arguments": []
              },
              "deprecatedSyntax": false
            }
          },
          {
            "$type": "Assignment",
            "feature": "Cache_type_name",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@107"
              },
              "arguments": []
            }
          }
        ]
      },
      "definesHiddenTokens": false,
      "entry": false,
      "fragment": false,
      "hiddenTokens": [],
      "parameters": [],
      "wildcard": false
    },
    {
      "$type": "ParserRule",
      "name": "Constant",
      "definition": {
        "$type": "Assignment",
        "feature": "constant",
        "operator": "=",
        "terminal": {
          "$type": "Alternatives",
          "elements": [
            {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@34"
              },
              "arguments": []
            },
            {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@35"
              },
              "arguments": []
            },
            {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@37"
              },
              "arguments": []
            },
            {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@33"
              },
              "arguments": []
            },
            {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@38"
              },
              "arguments": []
            },
            {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@39"
              },
              "arguments": []
            },
            {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@41"
              },
              "arguments": []
            },
            {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@40"
              },
              "arguments": []
            }
          ]
        }
      },
      "definesHiddenTokens": false,
      "entry": false,
      "fragment": false,
      "hiddenTokens": [],
      "parameters": [],
      "wildcard": false
    },
    {
      "$type": "ParserRule",
      "name": "Signed_Integer",
      "dataType": "number",
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "Alternatives",
            "elements": [
              {
                "$type": "Keyword",
                "value": "+"
              },
              {
                "$type": "Keyword",
                "value": "-"
              }
            ],
            "cardinality": "?"
          },
          {
            "$type": "RuleCall",
            "rule": {
              "$ref": "#/rules@140"
            },
            "arguments": []
          }
        ]
      },
      "definesHiddenTokens": false,
      "entry": false,
      "fragment": false,
      "hiddenTokens": [],
      "parameters": [],
      "wildcard": false,
      "$comment": "/* Numeric constants declarations */"
    },
    {
      "$type": "ParserRule",
      "name": "Unsigned_Integer",
      "dataType": "number",
      "definition": {
        "$type": "RuleCall",
        "rule": {
          "$ref": "#/rules@140"
        },
        "arguments": []
      },
      "definesHiddenTokens": false,
      "entry": false,
      "fragment": false,
      "hiddenTokens": [],
      "parameters": [],
      "wildcard": false
    },
    {
      "$type": "ParserRule",
      "name": "Nonprefix_integer_literal",
      "dataType": "number",
      "definition": {
        "$type": "Alternatives",
        "elements": [
          {
            "$type": "RuleCall",
            "rule": {
              "$ref": "#/rules@122"
            },
            "arguments": []
          },
          {
            "$type": "RuleCall",
            "rule": {
              "$ref": "#/rules@124"
            },
            "arguments": []
          },
          {
            "$type": "RuleCall",
            "rule": {
              "$ref": "#/rules@123"
            },
            "arguments": []
          }
        ]
      },
      "definesHiddenTokens": false,
      "entry": false,
      "fragment": false,
      "hiddenTokens": [],
      "parameters": [],
      "wildcard": false
    },
    {
      "$type": "ParserRule",
      "name": "Prefixed_integer_literal",
      "dataType": "number",
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "Group",
            "elements": [
              {
                "$type": "RuleCall",
                "rule": {
                  "$ref": "#/rules@36"
                },
                "arguments": []
              },
              {
                "$type": "Keyword",
                "value": "#"
              }
            ]
          },
          {
            "$type": "Alternatives",
            "elements": [
              {
                "$type": "RuleCall",
                "rule": {
                  "$ref": "#/rules@31"
                },
                "arguments": []
              },
              {
                "$type": "RuleCall",
                "rule": {
                  "$ref": "#/rules@122"
                },
                "arguments": []
              },
              {
                "$type": "RuleCall",
                "rule": {
                  "$ref": "#/rules@124"
                },
                "arguments": []
              },
              {
                "$type": "RuleCall",
                "rule": {
                  "$ref": "#/rules@123"
                },
                "arguments": []
              }
            ]
          }
        ]
      },
      "definesHiddenTokens": false,
      "entry": false,
      "fragment": false,
      "hiddenTokens": [],
      "parameters": [],
      "wildcard": false
    },
    {
      "$type": "ParserRule",
      "name": "Prefixed_bit_string_literal",
      "dataType": "number",
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "Group",
            "elements": [
              {
                "$type": "RuleCall",
                "rule": {
                  "$ref": "#/rules@110"
                },
                "arguments": []
              },
              {
                "$type": "Keyword",
                "value": "#"
              }
            ]
          },
          {
            "$type": "Alternatives",
            "elements": [
              {
                "$type": "RuleCall",
                "rule": {
                  "$ref": "#/rules@32"
                },
                "arguments": []
              },
              {
                "$type": "RuleCall",
                "rule": {
                  "$ref": "#/rules@122"
                },
                "arguments": []
              },
              {
                "$type": "RuleCall",
                "rule": {
                  "$ref": "#/rules@124"
                },
                "arguments": []
              },
              {
                "$type": "RuleCall",
                "rule": {
                  "$ref": "#/rules@123"
                },
                "arguments": []
              }
            ]
          }
        ]
      },
      "definesHiddenTokens": false,
      "entry": false,
      "fragment": false,
      "hiddenTokens": [],
      "parameters": [],
      "wildcard": false
    },
    {
      "$type": "ParserRule",
      "name": "Integer_type_name",
      "dataType": "number",
      "definition": {
        "$type": "Alternatives",
        "elements": [
          {
            "$type": "RuleCall",
            "rule": {
              "$ref": "#/rules@109"
            },
            "arguments": []
          },
          {
            "$type": "RuleCall",
            "rule": {
              "$ref": "#/rules@106"
            },
            "arguments": []
          }
        ]
      },
      "definesHiddenTokens": false,
      "entry": false,
      "fragment": false,
      "hiddenTokens": [],
      "parameters": [],
      "wildcard": false
    },
    {
      "$type": "ParserRule",
      "name": "Real_literal_or_signed_int",
      "dataType": "number",
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "Group",
            "elements": [
              {
                "$type": "RuleCall",
                "rule": {
                  "$ref": "#/rules@108"
                },
                "arguments": []
              },
              {
                "$type": "Keyword",
                "value": "#"
              }
            ],
            "cardinality": "?"
          },
          {
            "$type": "RuleCall",
            "rule": {
              "$ref": "#/rules@31"
            },
            "arguments": []
          },
          {
            "$type": "Group",
            "elements": [
              {
                "$type": "Keyword",
                "value": "."
              },
              {
                "$type": "RuleCall",
                "rule": {
                  "$ref": "#/rules@140"
                },
                "arguments": []
              },
              {
                "$type": "RuleCall",
                "rule": {
                  "$ref": "#/rules@121"
                },
                "arguments": [],
                "cardinality": "?"
              }
            ],
            "cardinality": "?"
          }
        ]
      },
      "definesHiddenTokens": false,
      "entry": false,
      "fragment": false,
      "hiddenTokens": [],
      "parameters": [],
      "wildcard": false
    },
    {
      "$type": "ParserRule",
      "name": "Boolean_literal",
      "dataType": "string",
      "definition": {
        "$type": "RuleCall",
        "rule": {
          "$ref": "#/rules@111"
        },
        "arguments": []
      },
      "definesHiddenTokens": false,
      "entry": false,
      "fragment": false,
      "hiddenTokens": [],
      "parameters": [],
      "wildcard": false,
      "$comment": "/* Boolean literals */"
    },
    {
      "$type": "ParserRule",
      "name": "Character_string",
      "dataType": "string",
      "definition": {
        "$type": "Alternatives",
        "elements": [
          {
            "$type": "RuleCall",
            "rule": {
              "$ref": "#/rules@125"
            },
            "arguments": []
          },
          {
            "$type": "RuleCall",
            "rule": {
              "$ref": "#/rules@126"
            },
            "arguments": []
          }
        ]
      },
      "definesHiddenTokens": false,
      "entry": false,
      "fragment": false,
      "hiddenTokens": [],
      "parameters": [],
      "wildcard": false,
      "$comment": "/* Character string literals  */"
    },
    {
      "$type": "ParserRule",
      "name": "Arr_string",
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "Keyword",
            "value": "["
          },
          {
            "$type": "Group",
            "elements": [
              {
                "$type": "Assignment",
                "feature": "arrElements",
                "operator": "+=",
                "terminal": {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@30"
                  },
                  "arguments": []
                }
              },
              {
                "$type": "Keyword",
                "value": ",",
                "cardinality": "*"
              }
            ],
            "cardinality": "*"
          },
          {
            "$type": "Keyword",
            "value": "]"
          }
        ]
      },
      "definesHiddenTokens": false,
      "entry": false,
      "fragment": false,
      "hiddenTokens": [],
      "parameters": [],
      "wildcard": false
    },
    {
      "$type": "ParserRule",
      "name": "Time_literal",
      "dataType": "string",
      "definition": {
        "$type": "Alternatives",
        "elements": [
          {
            "$type": "RuleCall",
            "rule": {
              "$ref": "#/rules@44"
            },
            "arguments": []
          },
          {
            "$type": "RuleCall",
            "rule": {
              "$ref": "#/rules@51"
            },
            "arguments": []
          },
          {
            "$type": "RuleCall",
            "rule": {
              "$ref": "#/rules@61"
            },
            "arguments": []
          },
          {
            "$type": "RuleCall",
            "rule": {
              "$ref": "#/rules@56"
            },
            "arguments": []
          }
        ]
      },
      "definesHiddenTokens": false,
      "entry": false,
      "fragment": false,
      "hiddenTokens": [],
      "parameters": [],
      "wildcard": false,
      "$comment": "/* Time literals */"
    },
    {
      "$type": "ParserRule",
      "name": "Array_liters",
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "Keyword",
            "value": "ARRAY"
          },
          {
            "$type": "Keyword",
            "value": "["
          },
          {
            "$type": "Group",
            "elements": [
              {
                "$type": "Assignment",
                "feature": "arrayElemets",
                "operator": "+=",
                "terminal": {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@43"
                  },
                  "arguments": []
                }
              },
              {
                "$type": "Keyword",
                "value": ",",
                "cardinality": "*"
              }
            ],
            "cardinality": "+"
          },
          {
            "$type": "Keyword",
            "value": "]"
          },
          {
            "$type": "Keyword",
            "value": "OF"
          },
          {
            "$type": "Assignment",
            "feature": "dataType",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@29"
              },
              "arguments": []
            }
          }
        ]
      },
      "definesHiddenTokens": false,
      "entry": false,
      "fragment": false,
      "hiddenTokens": [],
      "parameters": [],
      "wildcard": false
    },
    {
      "$type": "ParserRule",
      "name": "Array_element",
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "Assignment",
            "feature": "left",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@140"
              },
              "arguments": []
            }
          },
          {
            "$type": "Keyword",
            "value": ".."
          },
          {
            "$type": "Assignment",
            "feature": "right",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@140"
              },
              "arguments": []
            }
          }
        ]
      },
      "definesHiddenTokens": false,
      "entry": false,
      "fragment": false,
      "hiddenTokens": [],
      "parameters": [],
      "wildcard": false
    },
    {
      "$type": "ParserRule",
      "name": "Duration",
      "dataType": "string",
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "Alternatives",
            "elements": [
              {
                "$type": "RuleCall",
                "rule": {
                  "$ref": "#/rules@116"
                },
                "arguments": []
              },
              {
                "$type": "Keyword",
                "value": "T"
              }
            ]
          },
          {
            "$type": "Keyword",
            "value": "#"
          },
          {
            "$type": "Keyword",
            "value": "-",
            "cardinality": "?"
          },
          {
            "$type": "RuleCall",
            "rule": {
              "$ref": "#/rules@45"
            },
            "arguments": []
          }
        ]
      },
      "definesHiddenTokens": false,
      "entry": false,
      "fragment": false,
      "hiddenTokens": [],
      "parameters": [],
      "wildcard": false,
      "$comment": "/* Time literals - duration  */"
    },
    {
      "$type": "ParserRule",
      "name": "Interval",
      "dataType": "string",
      "definition": {
        "$type": "Alternatives",
        "elements": [
          {
            "$type": "RuleCall",
            "rule": {
              "$ref": "#/rules@50"
            },
            "arguments": []
          },
          {
            "$type": "RuleCall",
            "rule": {
              "$ref": "#/rules@49"
            },
            "arguments": []
          },
          {
            "$type": "RuleCall",
            "rule": {
              "$ref": "#/rules@48"
            },
            "arguments": []
          },
          {
            "$type": "RuleCall",
            "rule": {
              "$ref": "#/rules@47"
            },
            "arguments": []
          },
          {
            "$type": "RuleCall",
            "rule": {
              "$ref": "#/rules@46"
            },
            "arguments": []
          }
        ]
      },
      "definesHiddenTokens": false,
      "entry": false,
      "fragment": false,
      "hiddenTokens": [],
      "parameters": [],
      "wildcard": false
    },
    {
      "$type": "ParserRule",
      "name": "Milliseconds",
      "dataType": "string",
      "definition": {
        "$type": "RuleCall",
        "rule": {
          "$ref": "#/rules@127"
        },
        "arguments": []
      },
      "definesHiddenTokens": false,
      "entry": false,
      "fragment": false,
      "hiddenTokens": [],
      "parameters": [],
      "wildcard": false
    },
    {
      "$type": "ParserRule",
      "name": "Seconds",
      "dataType": "string",
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "RuleCall",
            "rule": {
              "$ref": "#/rules@129"
            },
            "arguments": []
          },
          {
            "$type": "RuleCall",
            "rule": {
              "$ref": "#/rules@46"
            },
            "arguments": [],
            "cardinality": "?"
          }
        ]
      },
      "definesHiddenTokens": false,
      "entry": false,
      "fragment": false,
      "hiddenTokens": [],
      "parameters": [],
      "wildcard": false
    },
    {
      "$type": "ParserRule",
      "name": "Minutes",
      "dataType": "string",
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "RuleCall",
            "rule": {
              "$ref": "#/rules@128"
            },
            "arguments": []
          },
          {
            "$type": "RuleCall",
            "rule": {
              "$ref": "#/rules@47"
            },
            "arguments": [],
            "cardinality": "?"
          }
        ]
      },
      "definesHiddenTokens": false,
      "entry": false,
      "fragment": false,
      "hiddenTokens": [],
      "parameters": [],
      "wildcard": false
    },
    {
      "$type": "ParserRule",
      "name": "Hours",
      "dataType": "string",
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "RuleCall",
            "rule": {
              "$ref": "#/rules@131"
            },
            "arguments": []
          },
          {
            "$type": "RuleCall",
            "rule": {
              "$ref": "#/rules@48"
            },
            "arguments": [],
            "cardinality": "?"
          }
        ]
      },
      "definesHiddenTokens": false,
      "entry": false,
      "fragment": false,
      "hiddenTokens": [],
      "parameters": [],
      "wildcard": false
    },
    {
      "$type": "ParserRule",
      "name": "Days",
      "dataType": "string",
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "RuleCall",
            "rule": {
              "$ref": "#/rules@130"
            },
            "arguments": []
          },
          {
            "$type": "RuleCall",
            "rule": {
              "$ref": "#/rules@49"
            },
            "arguments": [],
            "cardinality": "?"
          }
        ]
      },
      "definesHiddenTokens": false,
      "entry": false,
      "fragment": false,
      "hiddenTokens": [],
      "parameters": [],
      "wildcard": false
    },
    {
      "$type": "ParserRule",
      "name": "Time_of_day",
      "dataType": "string",
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "Alternatives",
            "elements": [
              {
                "$type": "RuleCall",
                "rule": {
                  "$ref": "#/rules@115"
                },
                "arguments": []
              },
              {
                "$type": "Keyword",
                "value": "TOD"
              }
            ]
          },
          {
            "$type": "Keyword",
            "value": "#"
          },
          {
            "$type": "RuleCall",
            "rule": {
              "$ref": "#/rules@52"
            },
            "arguments": []
          }
        ]
      },
      "definesHiddenTokens": false,
      "entry": false,
      "fragment": false,
      "hiddenTokens": [],
      "parameters": [],
      "wildcard": false,
      "$comment": "/* Time literals - time of the day */"
    },
    {
      "$type": "ParserRule",
      "name": "Daytime",
      "dataType": "string",
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "RuleCall",
            "rule": {
              "$ref": "#/rules@53"
            },
            "arguments": []
          },
          {
            "$type": "Keyword",
            "value": ":"
          },
          {
            "$type": "RuleCall",
            "rule": {
              "$ref": "#/rules@54"
            },
            "arguments": []
          },
          {
            "$type": "Keyword",
            "value": ":"
          },
          {
            "$type": "RuleCall",
            "rule": {
              "$ref": "#/rules@55"
            },
            "arguments": []
          }
        ]
      },
      "definesHiddenTokens": false,
      "entry": false,
      "fragment": false,
      "hiddenTokens": [],
      "parameters": [],
      "wildcard": false
    },
    {
      "$type": "ParserRule",
      "name": "Day_hour",
      "dataType": "string",
      "definition": {
        "$type": "RuleCall",
        "rule": {
          "$ref": "#/rules@140"
        },
        "arguments": []
      },
      "definesHiddenTokens": false,
      "entry": false,
      "fragment": false,
      "hiddenTokens": [],
      "parameters": [],
      "wildcard": false
    },
    {
      "$type": "ParserRule",
      "name": "Day_minute",
      "dataType": "string",
      "definition": {
        "$type": "RuleCall",
        "rule": {
          "$ref": "#/rules@140"
        },
        "arguments": []
      },
      "definesHiddenTokens": false,
      "entry": false,
      "fragment": false,
      "hiddenTokens": [],
      "parameters": [],
      "wildcard": false
    },
    {
      "$type": "ParserRule",
      "name": "Day_second",
      "dataType": "string",
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "RuleCall",
            "rule": {
              "$ref": "#/rules@140"
            },
            "arguments": []
          },
          {
            "$type": "Group",
            "elements": [
              {
                "$type": "Keyword",
                "value": "."
              },
              {
                "$type": "RuleCall",
                "rule": {
                  "$ref": "#/rules@140"
                },
                "arguments": []
              }
            ],
            "cardinality": "?"
          }
        ]
      },
      "definesHiddenTokens": false,
      "entry": false,
      "fragment": false,
      "hiddenTokens": [],
      "parameters": [],
      "wildcard": false
    },
    {
      "$type": "ParserRule",
      "name": "Date_type",
      "dataType": "string",
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "RuleCall",
            "rule": {
              "$ref": "#/rules@117"
            },
            "arguments": []
          },
          {
            "$type": "Keyword",
            "value": "#"
          },
          {
            "$type": "RuleCall",
            "rule": {
              "$ref": "#/rules@57"
            },
            "arguments": []
          }
        ]
      },
      "definesHiddenTokens": false,
      "entry": false,
      "fragment": false,
      "hiddenTokens": [],
      "parameters": [],
      "wildcard": false
    },
    {
      "$type": "ParserRule",
      "name": "Date_literal",
      "dataType": "string",
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "RuleCall",
            "rule": {
              "$ref": "#/rules@58"
            },
            "arguments": []
          },
          {
            "$type": "Keyword",
            "value": "-"
          },
          {
            "$type": "RuleCall",
            "rule": {
              "$ref": "#/rules@59"
            },
            "arguments": []
          },
          {
            "$type": "Keyword",
            "value": "-"
          },
          {
            "$type": "RuleCall",
            "rule": {
              "$ref": "#/rules@60"
            },
            "arguments": []
          }
        ]
      },
      "definesHiddenTokens": false,
      "entry": false,
      "fragment": false,
      "hiddenTokens": [],
      "parameters": [],
      "wildcard": false
    },
    {
      "$type": "ParserRule",
      "name": "Year",
      "dataType": "string",
      "definition": {
        "$type": "RuleCall",
        "rule": {
          "$ref": "#/rules@140"
        },
        "arguments": []
      },
      "definesHiddenTokens": false,
      "entry": false,
      "fragment": false,
      "hiddenTokens": [],
      "parameters": [],
      "wildcard": false
    },
    {
      "$type": "ParserRule",
      "name": "Month",
      "dataType": "string",
      "definition": {
        "$type": "RuleCall",
        "rule": {
          "$ref": "#/rules@140"
        },
        "arguments": []
      },
      "definesHiddenTokens": false,
      "entry": false,
      "fragment": false,
      "hiddenTokens": [],
      "parameters": [],
      "wildcard": false
    },
    {
      "$type": "ParserRule",
      "name": "Day",
      "dataType": "string",
      "definition": {
        "$type": "RuleCall",
        "rule": {
          "$ref": "#/rules@140"
        },
        "arguments": []
      },
      "definesHiddenTokens": false,
      "entry": false,
      "fragment": false,
      "hiddenTokens": [],
      "parameters": [],
      "wildcard": false
    },
    {
      "$type": "ParserRule",
      "name": "Date_and_time",
      "dataType": "string",
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "Alternatives",
            "elements": [
              {
                "$type": "RuleCall",
                "rule": {
                  "$ref": "#/rules@114"
                },
                "arguments": []
              },
              {
                "$type": "Keyword",
                "value": "DT"
              }
            ]
          },
          {
            "$type": "Keyword",
            "value": "#"
          },
          {
            "$type": "RuleCall",
            "rule": {
              "$ref": "#/rules@57"
            },
            "arguments": []
          },
          {
            "$type": "Group",
            "elements": [
              {
                "$type": "Keyword",
                "value": "-"
              },
              {
                "$type": "RuleCall",
                "rule": {
                  "$ref": "#/rules@52"
                },
                "arguments": []
              }
            ],
            "cardinality": "?"
          }
        ]
      },
      "definesHiddenTokens": false,
      "entry": false,
      "fragment": false,
      "hiddenTokens": [],
      "parameters": [],
      "wildcard": false
    },
    {
      "$type": "ParserRule",
      "name": "Expression",
      "definition": {
        "$type": "RuleCall",
        "rule": {
          "$ref": "#/rules@63"
        },
        "arguments": []
      },
      "definesHiddenTokens": false,
      "entry": false,
      "fragment": false,
      "hiddenTokens": [],
      "parameters": [],
      "wildcard": false,
      "$comment": "/* Expressions */"
    },
    {
      "$type": "ParserRule",
      "name": "Or_expression",
      "inferredType": {
        "$type": "InferredType",
        "name": "Expression"
      },
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "RuleCall",
            "rule": {
              "$ref": "#/rules@64"
            },
            "arguments": []
          },
          {
            "$type": "Group",
            "elements": [
              {
                "$type": "Action",
                "inferredType": {
                  "$type": "InferredType",
                  "name": "Expression"
                },
                "feature": "left",
                "operator": "="
              },
              {
                "$type": "Assignment",
                "feature": "operator",
                "operator": "=",
                "terminal": {
                  "$type": "Keyword",
                  "value": "OR"
                }
              },
              {
                "$type": "Assignment",
                "feature": "right",
                "operator": "=",
                "terminal": {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@64"
                  },
                  "arguments": []
                }
              }
            ],
            "cardinality": "*"
          }
        ]
      },
      "definesHiddenTokens": false,
      "entry": false,
      "fragment": false,
      "hiddenTokens": [],
      "parameters": [],
      "wildcard": false
    },
    {
      "$type": "ParserRule",
      "name": "Xor_expression",
      "inferredType": {
        "$type": "InferredType",
        "name": "Expression"
      },
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "RuleCall",
            "rule": {
              "$ref": "#/rules@65"
            },
            "arguments": []
          },
          {
            "$type": "Group",
            "elements": [
              {
                "$type": "Action",
                "inferredType": {
                  "$type": "InferredType",
                  "name": "Expression"
                },
                "feature": "left",
                "operator": "="
              },
              {
                "$type": "Assignment",
                "feature": "operator",
                "operator": "=",
                "terminal": {
                  "$type": "Keyword",
                  "value": "XOR"
                }
              },
              {
                "$type": "Assignment",
                "feature": "right",
                "operator": "=",
                "terminal": {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@65"
                  },
                  "arguments": []
                }
              }
            ],
            "cardinality": "*"
          }
        ]
      },
      "definesHiddenTokens": false,
      "entry": false,
      "fragment": false,
      "hiddenTokens": [],
      "parameters": [],
      "wildcard": false
    },
    {
      "$type": "ParserRule",
      "name": "And_expression",
      "inferredType": {
        "$type": "InferredType",
        "name": "Expression"
      },
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "RuleCall",
            "rule": {
              "$ref": "#/rules@66"
            },
            "arguments": []
          },
          {
            "$type": "Group",
            "elements": [
              {
                "$type": "Action",
                "inferredType": {
                  "$type": "InferredType",
                  "name": "Expression"
                },
                "feature": "left",
                "operator": "="
              },
              {
                "$type": "Assignment",
                "feature": "operator",
                "operator": "=",
                "terminal": {
                  "$type": "Alternatives",
                  "elements": [
                    {
                      "$type": "Keyword",
                      "value": "AND"
                    },
                    {
                      "$type": "Keyword",
                      "value": "&"
                    }
                  ]
                }
              },
              {
                "$type": "Assignment",
                "feature": "right",
                "operator": "=",
                "terminal": {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@66"
                  },
                  "arguments": []
                }
              }
            ],
            "cardinality": "*"
          }
        ]
      },
      "definesHiddenTokens": false,
      "entry": false,
      "fragment": false,
      "hiddenTokens": [],
      "parameters": [],
      "wildcard": false
    },
    {
      "$type": "ParserRule",
      "name": "Comparison_expression",
      "inferredType": {
        "$type": "InferredType",
        "name": "Expression"
      },
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "RuleCall",
            "rule": {
              "$ref": "#/rules@67"
            },
            "arguments": []
          },
          {
            "$type": "Group",
            "elements": [
              {
                "$type": "Action",
                "inferredType": {
                  "$type": "InferredType",
                  "name": "Expression"
                },
                "feature": "left",
                "operator": "="
              },
              {
                "$type": "Assignment",
                "feature": "operator",
                "operator": "=",
                "terminal": {
                  "$type": "Alternatives",
                  "elements": [
                    {
                      "$type": "Keyword",
                      "value": "<>"
                    },
                    {
                      "$type": "Keyword",
                      "value": "="
                    }
                  ]
                }
              },
              {
                "$type": "Assignment",
                "feature": "right",
                "operator": "=",
                "terminal": {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@67"
                  },
                  "arguments": []
                }
              }
            ],
            "cardinality": "*"
          }
        ]
      },
      "definesHiddenTokens": false,
      "entry": false,
      "fragment": false,
      "hiddenTokens": [],
      "parameters": [],
      "wildcard": false
    },
    {
      "$type": "ParserRule",
      "name": "Equ_expression",
      "inferredType": {
        "$type": "InferredType",
        "name": "Expression"
      },
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "RuleCall",
            "rule": {
              "$ref": "#/rules@68"
            },
            "arguments": []
          },
          {
            "$type": "Group",
            "elements": [
              {
                "$type": "Action",
                "inferredType": {
                  "$type": "InferredType",
                  "name": "Expression"
                },
                "feature": "left",
                "operator": "="
              },
              {
                "$type": "Assignment",
                "feature": "operator",
                "operator": "=",
                "terminal": {
                  "$type": "Alternatives",
                  "elements": [
                    {
                      "$type": "Keyword",
                      "value": "<="
                    },
                    {
                      "$type": "Keyword",
                      "value": ">="
                    },
                    {
                      "$type": "Keyword",
                      "value": "<"
                    },
                    {
                      "$type": "Keyword",
                      "value": ">"
                    }
                  ]
                }
              },
              {
                "$type": "Assignment",
                "feature": "right",
                "operator": "=",
                "terminal": {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@68"
                  },
                  "arguments": []
                }
              }
            ],
            "cardinality": "*"
          }
        ]
      },
      "definesHiddenTokens": false,
      "entry": false,
      "fragment": false,
      "hiddenTokens": [],
      "parameters": [],
      "wildcard": false
    },
    {
      "$type": "ParserRule",
      "name": "Add_expression",
      "inferredType": {
        "$type": "InferredType",
        "name": "Expression"
      },
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "RuleCall",
            "rule": {
              "$ref": "#/rules@69"
            },
            "arguments": []
          },
          {
            "$type": "Group",
            "elements": [
              {
                "$type": "Action",
                "inferredType": {
                  "$type": "InferredType",
                  "name": "Expression"
                },
                "feature": "left",
                "operator": "="
              },
              {
                "$type": "Assignment",
                "feature": "operator",
                "operator": "=",
                "terminal": {
                  "$type": "Alternatives",
                  "elements": [
                    {
                      "$type": "Keyword",
                      "value": "+"
                    },
                    {
                      "$type": "Keyword",
                      "value": "-"
                    }
                  ]
                }
              },
              {
                "$type": "Assignment",
                "feature": "right",
                "operator": "=",
                "terminal": {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@69"
                  },
                  "arguments": []
                }
              }
            ],
            "cardinality": "*"
          }
        ]
      },
      "definesHiddenTokens": false,
      "entry": false,
      "fragment": false,
      "hiddenTokens": [],
      "parameters": [],
      "wildcard": false
    },
    {
      "$type": "ParserRule",
      "name": "Term",
      "inferredType": {
        "$type": "InferredType",
        "name": "Expression"
      },
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "RuleCall",
            "rule": {
              "$ref": "#/rules@70"
            },
            "arguments": []
          },
          {
            "$type": "Group",
            "elements": [
              {
                "$type": "Action",
                "inferredType": {
                  "$type": "InferredType",
                  "name": "Expression"
                },
                "feature": "left",
                "operator": "="
              },
              {
                "$type": "Assignment",
                "feature": "operator",
                "operator": "=",
                "terminal": {
                  "$type": "Alternatives",
                  "elements": [
                    {
                      "$type": "Keyword",
                      "value": "*"
                    },
                    {
                      "$type": "Keyword",
                      "value": "/"
                    },
                    {
                      "$type": "Keyword",
                      "value": "MOD"
                    }
                  ]
                }
              },
              {
                "$type": "Assignment",
                "feature": "right",
                "operator": "=",
                "terminal": {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@70"
                  },
                  "arguments": []
                }
              }
            ],
            "cardinality": "*"
          }
        ]
      },
      "definesHiddenTokens": false,
      "entry": false,
      "fragment": false,
      "hiddenTokens": [],
      "parameters": [],
      "wildcard": false
    },
    {
      "$type": "ParserRule",
      "name": "Power_expression",
      "inferredType": {
        "$type": "InferredType",
        "name": "Expression"
      },
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "RuleCall",
            "rule": {
              "$ref": "#/rules@101"
            },
            "arguments": []
          },
          {
            "$type": "Group",
            "elements": [
              {
                "$type": "Action",
                "inferredType": {
                  "$type": "InferredType",
                  "name": "Expression"
                },
                "feature": "left",
                "operator": "="
              },
              {
                "$type": "Assignment",
                "feature": "operator",
                "operator": "=",
                "terminal": {
                  "$type": "Keyword",
                  "value": "**"
                }
              },
              {
                "$type": "Assignment",
                "feature": "right",
                "operator": "=",
                "terminal": {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@101"
                  },
                  "arguments": []
                }
              }
            ],
            "cardinality": "*"
          }
        ]
      },
      "definesHiddenTokens": false,
      "entry": false,
      "fragment": false,
      "hiddenTokens": [],
      "parameters": [],
      "wildcard": false
    },
    {
      "$type": "ParserRule",
      "name": "Unary_expression",
      "inferredType": {
        "$type": "InferredType",
        "name": "Expression"
      },
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "Assignment",
            "feature": "operator",
            "operator": "=",
            "terminal": {
              "$type": "Alternatives",
              "elements": [
                {
                  "$type": "Keyword",
                  "value": "-"
                },
                {
                  "$type": "Keyword",
                  "value": "NOT"
                }
              ]
            }
          },
          {
            "$type": "Assignment",
            "feature": "value",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@62"
              },
              "arguments": []
            }
          }
        ]
      },
      "definesHiddenTokens": false,
      "entry": false,
      "fragment": false,
      "hiddenTokens": [],
      "parameters": [],
      "wildcard": false
    },
    {
      "$type": "ParserRule",
      "name": "Primary_Expression",
      "inferredType": {
        "$type": "InferredType",
        "name": "Expression"
      },
      "definition": {
        "$type": "Alternatives",
        "elements": [
          {
            "$type": "RuleCall",
            "rule": {
              "$ref": "#/rules@30"
            },
            "arguments": []
          },
          {
            "$type": "Group",
            "elements": [
              {
                "$type": "Keyword",
                "value": "("
              },
              {
                "$type": "RuleCall",
                "rule": {
                  "$ref": "#/rules@62"
                },
                "arguments": []
              },
              {
                "$type": "Keyword",
                "value": ")"
              }
            ]
          },
          {
            "$type": "RuleCall",
            "rule": {
              "$ref": "#/rules@74"
            },
            "arguments": []
          },
          {
            "$type": "RuleCall",
            "rule": {
              "$ref": "#/rules@73"
            },
            "arguments": []
          },
          {
            "$type": "RuleCall",
            "rule": {
              "$ref": "#/rules@76"
            },
            "arguments": []
          },
          {
            "$type": "RuleCall",
            "rule": {
              "$ref": "#/rules@71"
            },
            "arguments": []
          },
          {
            "$type": "RuleCall",
            "rule": {
              "$ref": "#/rules@102"
            },
            "arguments": []
          }
        ]
      },
      "definesHiddenTokens": false,
      "entry": false,
      "fragment": false,
      "hiddenTokens": [],
      "parameters": [],
      "wildcard": false
    },
    {
      "$type": "ParserRule",
      "name": "EnumeratedValue",
      "inferredType": {
        "$type": "InferredType",
        "name": "Expression"
      },
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "Action",
            "inferredType": {
              "$type": "InferredType",
              "name": "EnumeratedValue"
            }
          },
          {
            "$type": "Alternatives",
            "elements": [
              {
                "$type": "Assignment",
                "feature": "enumType",
                "operator": "=",
                "terminal": {
                  "$type": "CrossReference",
                  "type": {
                    "$ref": "#/rules@27"
                  },
                  "terminal": {
                    "$type": "RuleCall",
                    "rule": {
                      "$ref": "#/rules@119"
                    },
                    "arguments": []
                  },
                  "deprecatedSyntax": false
                }
              },
              {
                "$type": "Assignment",
                "feature": "enumCacheTypeName",
                "operator": "=",
                "terminal": {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@107"
                  },
                  "arguments": []
                }
              }
            ]
          },
          {
            "$type": "Keyword",
            "value": "#"
          },
          {
            "$type": "Assignment",
            "feature": "enumValue",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@119"
              },
              "arguments": []
            }
          }
        ]
      },
      "definesHiddenTokens": false,
      "entry": false,
      "fragment": false,
      "hiddenTokens": [],
      "parameters": [],
      "wildcard": false
    },
    {
      "$type": "ParserRule",
      "name": "FunctionExpression",
      "inferredType": {
        "$type": "InferredType",
        "name": "Expression"
      },
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "Action",
            "inferredType": {
              "$type": "InferredType",
              "name": "FunctionExpression"
            }
          },
          {
            "$type": "Assignment",
            "feature": "refFunctionName",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@75"
              },
              "arguments": []
            }
          },
          {
            "$type": "Assignment",
            "feature": "params",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@87"
              },
              "arguments": []
            }
          }
        ]
      },
      "definesHiddenTokens": false,
      "entry": false,
      "fragment": false,
      "hiddenTokens": [],
      "parameters": [],
      "wildcard": false
    },
    {
      "$type": "ParserRule",
      "name": "RefFunctionOrBlockName",
      "definition": {
        "$type": "Alternatives",
        "elements": [
          {
            "$type": "Assignment",
            "feature": "refFunctionName",
            "operator": "=",
            "terminal": {
              "$type": "CrossReference",
              "type": {
                "$ref": "#/types@0"
              },
              "terminal": {
                "$type": "RuleCall",
                "rule": {
                  "$ref": "#/rules@119"
                },
                "arguments": []
              },
              "deprecatedSyntax": false
            }
          },
          {
            "$type": "Assignment",
            "feature": "Cache_type_name",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@107"
              },
              "arguments": []
            }
          }
        ]
      },
      "definesHiddenTokens": false,
      "entry": false,
      "fragment": false,
      "hiddenTokens": [],
      "parameters": [],
      "wildcard": false
    },
    {
      "$type": "ParserRule",
      "name": "VariableExpression",
      "inferredType": {
        "$type": "InferredType",
        "name": "Expression"
      },
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "Action",
            "inferredType": {
              "$type": "InferredType",
              "name": "VariableExpression"
            }
          },
          {
            "$type": "Assignment",
            "feature": "variable",
            "operator": "=",
            "terminal": {
              "$type": "CrossReference",
              "type": {
                "$ref": "#/types@1"
              },
              "terminal": {
                "$type": "RuleCall",
                "rule": {
                  "$ref": "#/rules@9"
                },
                "arguments": []
              },
              "deprecatedSyntax": false
            }
          }
        ]
      },
      "definesHiddenTokens": false,
      "entry": false,
      "fragment": false,
      "hiddenTokens": [],
      "parameters": [],
      "wildcard": false
    },
    {
      "$type": "ParserRule",
      "name": "Statement_list",
      "definition": {
        "$type": "Assignment",
        "feature": "statements",
        "operator": "+=",
        "terminal": {
          "$type": "RuleCall",
          "rule": {
            "$ref": "#/rules@79"
          },
          "arguments": []
        },
        "cardinality": "*"
      },
      "definesHiddenTokens": false,
      "entry": false,
      "fragment": false,
      "hiddenTokens": [],
      "parameters": [],
      "wildcard": false,
      "$comment": "/* ST statements */"
    },
    {
      "$type": "ParserRule",
      "name": "Statement_list_single",
      "definition": {
        "$type": "Assignment",
        "feature": "statements",
        "operator": "=",
        "terminal": {
          "$type": "RuleCall",
          "rule": {
            "$ref": "#/rules@79"
          },
          "arguments": []
        }
      },
      "definesHiddenTokens": false,
      "entry": false,
      "fragment": false,
      "hiddenTokens": [],
      "parameters": [],
      "wildcard": false
    },
    {
      "$type": "ParserRule",
      "name": "Statement",
      "definition": {
        "$type": "Alternatives",
        "elements": [
          {
            "$type": "Group",
            "elements": [
              {
                "$type": "RuleCall",
                "rule": {
                  "$ref": "#/rules@89"
                },
                "arguments": []
              },
              {
                "$type": "Keyword",
                "value": ";",
                "cardinality": "?"
              }
            ]
          },
          {
            "$type": "Group",
            "elements": [
              {
                "$type": "RuleCall",
                "rule": {
                  "$ref": "#/rules@81"
                },
                "arguments": []
              },
              {
                "$type": "Keyword",
                "value": ";"
              }
            ]
          },
          {
            "$type": "Group",
            "elements": [
              {
                "$type": "RuleCall",
                "rule": {
                  "$ref": "#/rules@95"
                },
                "arguments": []
              },
              {
                "$type": "Keyword",
                "value": ";",
                "cardinality": "?"
              }
            ]
          }
        ]
      },
      "definesHiddenTokens": false,
      "entry": false,
      "fragment": false,
      "hiddenTokens": [],
      "parameters": [],
      "wildcard": false
    },
    {
      "$type": "ParserRule",
      "name": "Action_call_statement",
      "definition": {
        "$type": "Assignment",
        "feature": "actionName",
        "operator": "=",
        "terminal": {
          "$type": "CrossReference",
          "type": {
            "$ref": "#/types@0"
          },
          "terminal": {
            "$type": "RuleCall",
            "rule": {
              "$ref": "#/rules@9"
            },
            "arguments": []
          },
          "deprecatedSyntax": false
        }
      },
      "definesHiddenTokens": false,
      "entry": false,
      "fragment": false,
      "hiddenTokens": [],
      "parameters": [],
      "wildcard": false
    },
    {
      "$type": "ParserRule",
      "name": "Function_invoke_or_assign_statement",
      "definition": {
        "$type": "Assignment",
        "feature": "statement",
        "operator": "=",
        "terminal": {
          "$type": "Alternatives",
          "elements": [
            {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@82"
              },
              "arguments": []
            },
            {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@85"
              },
              "arguments": []
            }
          ]
        }
      },
      "definesHiddenTokens": false,
      "entry": false,
      "fragment": false,
      "hiddenTokens": [],
      "parameters": [],
      "wildcard": false
    },
    {
      "$type": "ParserRule",
      "name": "Function_invoke_or_assign",
      "definition": {
        "$type": "Alternatives",
        "elements": [
          {
            "$type": "Group",
            "elements": [
              {
                "$type": "Assignment",
                "feature": "assignPrefix",
                "operator": "=",
                "terminal": {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@84"
                  },
                  "arguments": []
                }
              },
              {
                "$type": "Assignment",
                "feature": "assign",
                "operator": "=",
                "terminal": {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@86"
                  },
                  "arguments": []
                }
              }
            ]
          },
          {
            "$type": "Assignment",
            "feature": "id",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@74"
              },
              "arguments": []
            }
          },
          {
            "$type": "Group",
            "elements": [
              {
                "$type": "Assignment",
                "feature": "id",
                "operator": "=",
                "terminal": {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@83"
                  },
                  "arguments": []
                }
              },
              {
                "$type": "Alternatives",
                "elements": [
                  {
                    "$type": "Assignment",
                    "feature": "assign",
                    "operator": "=",
                    "terminal": {
                      "$type": "RuleCall",
                      "rule": {
                        "$ref": "#/rules@86"
                      },
                      "arguments": []
                    }
                  },
                  {
                    "$type": "Assignment",
                    "feature": "params",
                    "operator": "+=",
                    "terminal": {
                      "$type": "RuleCall",
                      "rule": {
                        "$ref": "#/rules@87"
                      },
                      "arguments": []
                    }
                  }
                ],
                "cardinality": "+"
              }
            ]
          }
        ]
      },
      "definesHiddenTokens": false,
      "entry": false,
      "fragment": false,
      "hiddenTokens": [],
      "parameters": [],
      "wildcard": false
    },
    {
      "$type": "ParserRule",
      "name": "StatementReceiver",
      "inferredType": {
        "$type": "InferredType",
        "name": "MemberCall"
      },
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "Assignment",
            "feature": "prior",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@76"
              },
              "arguments": []
            }
          },
          {
            "$type": "Group",
            "elements": [
              {
                "$type": "Action",
                "inferredType": {
                  "$type": "InferredType",
                  "name": "MemberCall"
                },
                "feature": "previous",
                "operator": "="
              },
              {
                "$type": "Keyword",
                "value": "."
              },
              {
                "$type": "Assignment",
                "feature": "element",
                "operator": "=",
                "terminal": {
                  "$type": "CrossReference",
                  "type": {
                    "$ref": "#/types@2"
                  },
                  "terminal": {
                    "$type": "RuleCall",
                    "rule": {
                      "$ref": "#/rules@119"
                    },
                    "arguments": []
                  },
                  "deprecatedSyntax": false
                }
              }
            ],
            "cardinality": "*"
          }
        ]
      },
      "definesHiddenTokens": false,
      "entry": false,
      "fragment": false,
      "hiddenTokens": [],
      "parameters": [],
      "wildcard": false
    },
    {
      "$type": "ParserRule",
      "name": "AssignPrefix",
      "definition": {
        "$type": "Assignment",
        "feature": "varEnchanceDecl",
        "operator": "=",
        "terminal": {
          "$type": "CrossReference",
          "type": {
            "$ref": "#/types@1"
          },
          "terminal": {
            "$type": "RuleCall",
            "rule": {
              "$ref": "#/rules@9"
            },
            "arguments": []
          },
          "deprecatedSyntax": false
        }
      },
      "definesHiddenTokens": false,
      "entry": false,
      "fragment": false,
      "hiddenTokens": [],
      "parameters": [],
      "wildcard": false
    },
    {
      "$type": "ParserRule",
      "name": "ReturnParse",
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "Assignment",
            "feature": "returnSign",
            "operator": "=",
            "terminal": {
              "$type": "Keyword",
              "value": "RETURN"
            }
          },
          {
            "$type": "Assignment",
            "feature": "returnValue",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@62"
              },
              "arguments": []
            },
            "cardinality": "?"
          }
        ]
      },
      "definesHiddenTokens": false,
      "entry": false,
      "fragment": false,
      "hiddenTokens": [],
      "parameters": [],
      "wildcard": false
    },
    {
      "$type": "ParserRule",
      "name": "Assignment_subrule",
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "Keyword",
            "value": ":="
          },
          {
            "$type": "Assignment",
            "feature": "expression",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@62"
              },
              "arguments": []
            },
            "cardinality": "*"
          }
        ]
      },
      "definesHiddenTokens": false,
      "entry": false,
      "fragment": false,
      "hiddenTokens": [],
      "parameters": [],
      "wildcard": false
    },
    {
      "$type": "ParserRule",
      "name": "Invoke_subrule",
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "Keyword",
            "value": "("
          },
          {
            "$type": "Group",
            "elements": [
              {
                "$type": "Assignment",
                "feature": "parameters",
                "operator": "+=",
                "terminal": {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@88"
                  },
                  "arguments": []
                }
              },
              {
                "$type": "Group",
                "elements": [
                  {
                    "$type": "Keyword",
                    "value": ","
                  },
                  {
                    "$type": "Assignment",
                    "feature": "parameters",
                    "operator": "+=",
                    "terminal": {
                      "$type": "RuleCall",
                      "rule": {
                        "$ref": "#/rules@88"
                      },
                      "arguments": []
                    }
                  }
                ],
                "cardinality": "*"
              }
            ],
            "cardinality": "?"
          },
          {
            "$type": "Keyword",
            "value": ")"
          }
        ]
      },
      "definesHiddenTokens": false,
      "entry": false,
      "fragment": false,
      "hiddenTokens": [],
      "parameters": [],
      "wildcard": false
    },
    {
      "$type": "ParserRule",
      "name": "Param_assignment",
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "Group",
            "elements": [
              {
                "$type": "Assignment",
                "feature": "ParamName",
                "operator": "=",
                "terminal": {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@9"
                  },
                  "arguments": []
                }
              },
              {
                "$type": "Assignment",
                "feature": "InputOrOutputSign",
                "operator": "=",
                "terminal": {
                  "$type": "Alternatives",
                  "elements": [
                    {
                      "$type": "Keyword",
                      "value": ":="
                    },
                    {
                      "$type": "Keyword",
                      "value": "=>"
                    }
                  ]
                }
              }
            ],
            "cardinality": "?"
          },
          {
            "$type": "Assignment",
            "feature": "ParamValue",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@62"
              },
              "arguments": []
            },
            "cardinality": "*"
          }
        ]
      },
      "definesHiddenTokens": false,
      "entry": false,
      "fragment": false,
      "hiddenTokens": [],
      "parameters": [],
      "wildcard": false
    },
    {
      "$type": "ParserRule",
      "name": "Selection_statement",
      "definition": {
        "$type": "Alternatives",
        "elements": [
          {
            "$type": "Assignment",
            "feature": "if",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@90"
              },
              "arguments": []
            }
          },
          {
            "$type": "Assignment",
            "feature": "case",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@91"
              },
              "arguments": []
            }
          }
        ]
      },
      "definesHiddenTokens": false,
      "entry": false,
      "fragment": false,
      "hiddenTokens": [],
      "parameters": [],
      "wildcard": false
    },
    {
      "$type": "ParserRule",
      "name": "If_statement",
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "Keyword",
            "value": "IF"
          },
          {
            "$type": "Assignment",
            "feature": "ifCondition",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@62"
              },
              "arguments": []
            }
          },
          {
            "$type": "Keyword",
            "value": "THEN"
          },
          {
            "$type": "Assignment",
            "feature": "ifStatement",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@77"
              },
              "arguments": []
            }
          },
          {
            "$type": "Group",
            "elements": [
              {
                "$type": "Keyword",
                "value": "ELSIF"
              },
              {
                "$type": "Assignment",
                "feature": "elsifConditions",
                "operator": "+=",
                "terminal": {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@62"
                  },
                  "arguments": []
                }
              },
              {
                "$type": "Keyword",
                "value": "THEN"
              },
              {
                "$type": "Assignment",
                "feature": "elsifStatements",
                "operator": "=",
                "terminal": {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@77"
                  },
                  "arguments": []
                }
              }
            ],
            "cardinality": "*"
          },
          {
            "$type": "Group",
            "elements": [
              {
                "$type": "Keyword",
                "value": "ELSE"
              },
              {
                "$type": "Assignment",
                "feature": "elseStatement",
                "operator": "=",
                "terminal": {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@77"
                  },
                  "arguments": []
                }
              }
            ],
            "cardinality": "?"
          },
          {
            "$type": "Keyword",
            "value": "END_IF"
          }
        ]
      },
      "definesHiddenTokens": false,
      "entry": false,
      "fragment": false,
      "hiddenTokens": [],
      "parameters": [],
      "wildcard": false
    },
    {
      "$type": "ParserRule",
      "name": "Case_statement",
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "Keyword",
            "value": "CASE"
          },
          {
            "$type": "Assignment",
            "feature": "caseExpression",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@62"
              },
              "arguments": []
            }
          },
          {
            "$type": "Keyword",
            "value": "OF"
          },
          {
            "$type": "Assignment",
            "feature": "caseElements",
            "operator": "+=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@92"
              },
              "arguments": []
            }
          },
          {
            "$type": "Assignment",
            "feature": "caseElements",
            "operator": "+=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@92"
              },
              "arguments": []
            },
            "cardinality": "*"
          },
          {
            "$type": "Group",
            "elements": [
              {
                "$type": "Keyword",
                "value": "ELSE"
              },
              {
                "$type": "Assignment",
                "feature": "elseStatements",
                "operator": "=",
                "terminal": {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@77"
                  },
                  "arguments": []
                }
              }
            ],
            "cardinality": "?"
          },
          {
            "$type": "Keyword",
            "value": "END_CASE"
          }
        ]
      },
      "definesHiddenTokens": false,
      "entry": false,
      "fragment": false,
      "hiddenTokens": [],
      "parameters": [],
      "wildcard": false
    },
    {
      "$type": "ParserRule",
      "name": "Case_element",
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "Assignment",
            "feature": "caseList",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@93"
              },
              "arguments": []
            }
          },
          {
            "$type": "Keyword",
            "value": ":"
          },
          {
            "$type": "Assignment",
            "feature": "statements",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@77"
              },
              "arguments": []
            }
          }
        ]
      },
      "definesHiddenTokens": false,
      "entry": false,
      "fragment": false,
      "hiddenTokens": [],
      "parameters": [],
      "wildcard": false
    },
    {
      "$type": "ParserRule",
      "name": "Case_list",
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "Assignment",
            "feature": "caseListElement",
            "operator": "+=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@94"
              },
              "arguments": []
            }
          },
          {
            "$type": "Group",
            "elements": [
              {
                "$type": "Keyword",
                "value": ","
              },
              {
                "$type": "Assignment",
                "feature": "caseListElement",
                "operator": "+=",
                "terminal": {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@94"
                  },
                  "arguments": []
                }
              }
            ],
            "cardinality": "*"
          }
        ]
      },
      "definesHiddenTokens": false,
      "entry": false,
      "fragment": false,
      "hiddenTokens": [],
      "parameters": [],
      "wildcard": false
    },
    {
      "$type": "ParserRule",
      "name": "Case_list_element",
      "definition": {
        "$type": "Alternatives",
        "elements": [
          {
            "$type": "Group",
            "elements": [
              {
                "$type": "Assignment",
                "feature": "numCaseStart",
                "operator": "=",
                "terminal": {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@31"
                  },
                  "arguments": []
                }
              },
              {
                "$type": "Group",
                "elements": [
                  {
                    "$type": "Keyword",
                    "value": ".."
                  },
                  {
                    "$type": "Assignment",
                    "feature": "numericCaseEnd",
                    "operator": "=",
                    "terminal": {
                      "$type": "RuleCall",
                      "rule": {
                        "$ref": "#/rules@31"
                      },
                      "arguments": []
                    }
                  }
                ],
                "cardinality": "?"
              }
            ]
          },
          {
            "$type": "Assignment",
            "feature": "enumCase",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@73"
              },
              "arguments": []
            }
          },
          {
            "$type": "Assignment",
            "feature": "simpleEnumCase",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@141"
              },
              "arguments": []
            }
          }
        ]
      },
      "definesHiddenTokens": false,
      "entry": false,
      "fragment": false,
      "hiddenTokens": [],
      "parameters": [],
      "wildcard": false
    },
    {
      "$type": "ParserRule",
      "name": "Iteration_statement",
      "definition": {
        "$type": "Assignment",
        "feature": "statement",
        "operator": "=",
        "terminal": {
          "$type": "Alternatives",
          "elements": [
            {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@96"
              },
              "arguments": []
            },
            {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@98"
              },
              "arguments": []
            },
            {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@99"
              },
              "arguments": []
            },
            {
              "$type": "Keyword",
              "value": "EXIT"
            }
          ]
        }
      },
      "definesHiddenTokens": false,
      "entry": false,
      "fragment": false,
      "hiddenTokens": [],
      "parameters": [],
      "wildcard": false,
      "$comment": "/* Iteration statements */"
    },
    {
      "$type": "ParserRule",
      "name": "For_statement",
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "Keyword",
            "value": "FOR"
          },
          {
            "$type": "Assignment",
            "feature": "controlVariable",
            "operator": "=",
            "terminal": {
              "$type": "CrossReference",
              "type": {
                "$ref": "#/types@2"
              },
              "terminal": {
                "$type": "RuleCall",
                "rule": {
                  "$ref": "#/rules@119"
                },
                "arguments": []
              },
              "deprecatedSyntax": false
            }
          },
          {
            "$type": "Keyword",
            "value": ":="
          },
          {
            "$type": "Assignment",
            "feature": "forList",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@97"
              },
              "arguments": []
            }
          },
          {
            "$type": "Keyword",
            "value": "DO"
          },
          {
            "$type": "Assignment",
            "feature": "statementList",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@77"
              },
              "arguments": []
            }
          },
          {
            "$type": "Keyword",
            "value": "END_FOR"
          }
        ]
      },
      "definesHiddenTokens": false,
      "entry": false,
      "fragment": false,
      "hiddenTokens": [],
      "parameters": [],
      "wildcard": false
    },
    {
      "$type": "ParserRule",
      "name": "For_list",
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "Assignment",
            "feature": "forExpr",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@62"
              },
              "arguments": []
            }
          },
          {
            "$type": "Keyword",
            "value": "TO"
          },
          {
            "$type": "Assignment",
            "feature": "toExpr",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@62"
              },
              "arguments": []
            }
          },
          {
            "$type": "Group",
            "elements": [
              {
                "$type": "Keyword",
                "value": "BY"
              },
              {
                "$type": "Assignment",
                "feature": "byExpr",
                "operator": "=",
                "terminal": {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@62"
                  },
                  "arguments": []
                }
              }
            ],
            "cardinality": "?"
          }
        ]
      },
      "definesHiddenTokens": false,
      "entry": false,
      "fragment": false,
      "hiddenTokens": [],
      "parameters": [],
      "wildcard": false
    },
    {
      "$type": "ParserRule",
      "name": "While_statement",
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "Keyword",
            "value": "WHILE"
          },
          {
            "$type": "Assignment",
            "feature": "whileExpr",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@62"
              },
              "arguments": []
            }
          },
          {
            "$type": "Keyword",
            "value": "DO"
          },
          {
            "$type": "Assignment",
            "feature": "statementList",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@77"
              },
              "arguments": []
            }
          },
          {
            "$type": "Keyword",
            "value": "END_WHILE"
          }
        ]
      },
      "definesHiddenTokens": false,
      "entry": false,
      "fragment": false,
      "hiddenTokens": [],
      "parameters": [],
      "wildcard": false
    },
    {
      "$type": "ParserRule",
      "name": "Repeat_statement",
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "Keyword",
            "value": "REPEAT"
          },
          {
            "$type": "Assignment",
            "feature": "statementList",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@77"
              },
              "arguments": []
            }
          },
          {
            "$type": "Keyword",
            "value": "UNTIL"
          },
          {
            "$type": "Assignment",
            "feature": "untilExpr",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@62"
              },
              "arguments": []
            }
          },
          {
            "$type": "Keyword",
            "value": "END_REPEAT"
          }
        ]
      },
      "definesHiddenTokens": false,
      "entry": false,
      "fragment": false,
      "hiddenTokens": [],
      "parameters": [],
      "wildcard": false
    },
    {
      "$type": "ParserRule",
      "name": "Direct_variable",
      "dataType": "string",
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "RuleCall",
            "rule": {
              "$ref": "#/rules@139"
            },
            "arguments": []
          },
          {
            "$type": "RuleCall",
            "rule": {
              "$ref": "#/rules@140"
            },
            "arguments": []
          },
          {
            "$type": "Group",
            "elements": [
              {
                "$type": "Keyword",
                "value": "."
              },
              {
                "$type": "RuleCall",
                "rule": {
                  "$ref": "#/rules@140"
                },
                "arguments": []
              }
            ],
            "cardinality": "?"
          }
        ]
      },
      "definesHiddenTokens": false,
      "entry": false,
      "fragment": false,
      "hiddenTokens": [],
      "parameters": [],
      "wildcard": false
    },
    {
      "$type": "ParserRule",
      "name": "MemberCall",
      "inferredType": {
        "$type": "InferredType",
        "name": "Expression"
      },
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "Assignment",
            "feature": "prior",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@72"
              },
              "arguments": []
            }
          },
          {
            "$type": "Group",
            "elements": [
              {
                "$type": "Action",
                "inferredType": {
                  "$type": "InferredType",
                  "name": "MemberCall"
                },
                "feature": "previous",
                "operator": "="
              },
              {
                "$type": "Alternatives",
                "elements": [
                  {
                    "$type": "Group",
                    "elements": [
                      {
                        "$type": "Keyword",
                        "value": "."
                      },
                      {
                        "$type": "Assignment",
                        "feature": "element",
                        "operator": "=",
                        "terminal": {
                          "$type": "CrossReference",
                          "type": {
                            "$ref": "#/types@2"
                          },
                          "terminal": {
                            "$type": "RuleCall",
                            "rule": {
                              "$ref": "#/rules@119"
                            },
                            "arguments": []
                          },
                          "deprecatedSyntax": false
                        }
                      },
                      {
                        "$type": "Group",
                        "elements": [
                          {
                            "$type": "Assignment",
                            "feature": "explicitOperationCall",
                            "operator": "?=",
                            "terminal": {
                              "$type": "Keyword",
                              "value": "("
                            }
                          },
                          {
                            "$type": "Group",
                            "elements": [
                              {
                                "$type": "Assignment",
                                "feature": "arguments",
                                "operator": "+=",
                                "terminal": {
                                  "$type": "RuleCall",
                                  "rule": {
                                    "$ref": "#/rules@62"
                                  },
                                  "arguments": []
                                }
                              },
                              {
                                "$type": "Group",
                                "elements": [
                                  {
                                    "$type": "Keyword",
                                    "value": ","
                                  },
                                  {
                                    "$type": "Assignment",
                                    "feature": "arguments",
                                    "operator": "+=",
                                    "terminal": {
                                      "$type": "RuleCall",
                                      "rule": {
                                        "$ref": "#/rules@62"
                                      },
                                      "arguments": []
                                    }
                                  }
                                ],
                                "cardinality": "*"
                              }
                            ],
                            "cardinality": "?"
                          },
                          {
                            "$type": "Keyword",
                            "value": ")"
                          }
                        ],
                        "cardinality": "?"
                      }
                    ]
                  },
                  {
                    "$type": "Group",
                    "elements": [
                      {
                        "$type": "Assignment",
                        "feature": "explicitOperationCall",
                        "operator": "?=",
                        "terminal": {
                          "$type": "Keyword",
                          "value": "("
                        }
                      },
                      {
                        "$type": "Group",
                        "elements": [
                          {
                            "$type": "Assignment",
                            "feature": "arguments",
                            "operator": "+=",
                            "terminal": {
                              "$type": "RuleCall",
                              "rule": {
                                "$ref": "#/rules@62"
                              },
                              "arguments": []
                            }
                          },
                          {
                            "$type": "Group",
                            "elements": [
                              {
                                "$type": "Keyword",
                                "value": ","
                              },
                              {
                                "$type": "Assignment",
                                "feature": "arguments",
                                "operator": "+=",
                                "terminal": {
                                  "$type": "RuleCall",
                                  "rule": {
                                    "$ref": "#/rules@62"
                                  },
                                  "arguments": []
                                }
                              }
                            ],
                            "cardinality": "*"
                          }
                        ],
                        "cardinality": "?"
                      },
                      {
                        "$type": "Keyword",
                        "value": ")"
                      }
                    ]
                  }
                ]
              }
            ],
            "cardinality": "*"
          }
        ]
      },
      "definesHiddenTokens": false,
      "entry": false,
      "fragment": false,
      "hiddenTokens": [],
      "parameters": [],
      "wildcard": false
    },
    {
      "$type": "ParserRule",
      "name": "FeatureCall",
      "inferredType": {
        "$type": "InferredType",
        "name": "Expression"
      },
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "Action",
            "inferredType": {
              "$type": "InferredType",
              "name": "MemberCall"
            }
          },
          {
            "$type": "Assignment",
            "feature": "element",
            "operator": "=",
            "terminal": {
              "$type": "CrossReference",
              "type": {
                "$ref": "#/types@2"
              },
              "terminal": {
                "$type": "RuleCall",
                "rule": {
                  "$ref": "#/rules@119"
                },
                "arguments": []
              },
              "deprecatedSyntax": false
            }
          },
          {
            "$type": "Group",
            "elements": [
              {
                "$type": "Assignment",
                "feature": "explicitOperationCall",
                "operator": "?=",
                "terminal": {
                  "$type": "Keyword",
                  "value": "("
                }
              },
              {
                "$type": "Group",
                "elements": [
                  {
                    "$type": "Assignment",
                    "feature": "arguments",
                    "operator": "+=",
                    "terminal": {
                      "$type": "RuleCall",
                      "rule": {
                        "$ref": "#/rules@62"
                      },
                      "arguments": []
                    }
                  },
                  {
                    "$type": "Group",
                    "elements": [
                      {
                        "$type": "Keyword",
                        "value": ","
                      },
                      {
                        "$type": "Assignment",
                        "feature": "arguments",
                        "operator": "+=",
                        "terminal": {
                          "$type": "RuleCall",
                          "rule": {
                            "$ref": "#/rules@62"
                          },
                          "arguments": []
                        }
                      }
                    ],
                    "cardinality": "*"
                  }
                ],
                "cardinality": "?"
              },
              {
                "$type": "Keyword",
                "value": ")"
              }
            ],
            "cardinality": "?"
          }
        ]
      },
      "definesHiddenTokens": false,
      "entry": false,
      "fragment": false,
      "hiddenTokens": [],
      "parameters": [],
      "wildcard": false
    },
    {
      "$type": "ParserRule",
      "name": "Variable_name",
      "dataType": "string",
      "definition": {
        "$type": "RuleCall",
        "rule": {
          "$ref": "#/rules@119"
        },
        "arguments": []
      },
      "definesHiddenTokens": false,
      "entry": false,
      "fragment": false,
      "hiddenTokens": [],
      "parameters": [],
      "wildcard": false
    },
    {
      "$type": "ParserRule",
      "name": "Subscript_list",
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "Keyword",
            "value": "["
          },
          {
            "$type": "RuleCall",
            "rule": {
              "$ref": "#/rules@105"
            },
            "arguments": []
          },
          {
            "$type": "Group",
            "elements": [
              {
                "$type": "Keyword",
                "value": ","
              },
              {
                "$type": "RuleCall",
                "rule": {
                  "$ref": "#/rules@105"
                },
                "arguments": []
              }
            ],
            "cardinality": "*"
          },
          {
            "$type": "Keyword",
            "value": "]"
          }
        ]
      },
      "definesHiddenTokens": false,
      "entry": false,
      "fragment": false,
      "hiddenTokens": [],
      "parameters": [],
      "wildcard": false
    },
    {
      "$type": "ParserRule",
      "name": "Subscript",
      "inferredType": {
        "$type": "InferredType",
        "name": "Expression"
      },
      "definition": {
        "$type": "RuleCall",
        "rule": {
          "$ref": "#/rules@62"
        },
        "arguments": []
      },
      "definesHiddenTokens": false,
      "entry": false,
      "fragment": false,
      "hiddenTokens": [],
      "parameters": [],
      "wildcard": false
    },
    {
      "$type": "TerminalRule",
      "name": "Signed_integer_type_name",
      "definition": {
        "$type": "RegexToken",
        "regex": "/\\\\b(?:SINT|INT|DINT|LINT)\\\\b/i"
      },
      "fragment": false,
      "hidden": false
    },
    {
      "$type": "TerminalRule",
      "name": "Cache_type_name",
      "definition": {
        "$type": "RegexToken",
        "regex": "/\\\\b(?:RTC|INTEGRAL|DERIVATIVE|PID|RAMP|HYSTERESIS|F_TRIG|RS|R_TRIG|SR|BOOL_TO_SINT|BOOL_TO_INT|BOOL_TO_DINT|BOOL_TO_LINT|BOOL_TO_USINT|BOOL_TO_UINT|BOOL_TO_UDINT|BOOL_TO_ULINT|BOOL_TO_REAL|BOOL_TO_LREAL|BOOL_TO_TIME|BOOL_TO_DATE|BOOL_TO_TOD|BOOL_TO_DT|BOOL_TO_STRING|BOOL_TO_BYTE|BOOL_TO_WORD|BOOL_TO_DWORD|BOOL_TO_LWORD|SINT_TO_BOOL|SINT_TO_INT|SINT_TO_DINT|SINT_TO_LINT|SINT_TO_USINT|SINT_TO_UINT|SINT_TO_UDINT|SINT_TO_ULINT|SINT_TO_REAL|SINT_TO_LREAL|SINT_TO_TIME|SINT_TO_DATE|SINT_TO_TOD|SINT_TO_DT|SINT_TO_STRING|SINT_TO_BYTE|SINT_TO_WORD|SINT_TO_DWORD|SINT_TO_LWORD|INT_TO_BOOL|INT_TO_SINT|INT_TO_DINT|INT_TO_LINT|INT_TO_USINT|INT_TO_UINT|INT_TO_UDINT|INT_TO_ULINT|INT_TO_REAL|INT_TO_LREAL|INT_TO_TIME|INT_TO_DATE|INT_TO_TOD|INT_TO_DT|INT_TO_STRING|INT_TO_BYTE|INT_TO_WORD|INT_TO_DWORD|INT_TO_LWORD|DINT_TO_BOOL|DINT_TO_SINT|DINT_TO_INT|DINT_TO_LINT|DINT_TO_USINT|DINT_TO_UINT|DINT_TO_UDINT|DINT_TO_ULINT|DINT_TO_REAL|DINT_TO_LREAL|DINT_TO_TIME|DINT_TO_DATE|DINT_TO_TOD|DINT_TO_DT|DINT_TO_STRING|DINT_TO_BYTE|DINT_TO_WORD|DINT_TO_DWORD|DINT_TO_LWORD|LINT_TO_BOOL|LINT_TO_SINT|LINT_TO_INT|LINT_TO_DINT|LINT_TO_USINT|LINT_TO_UINT|LINT_TO_UDINT|LINT_TO_ULINT|LINT_TO_REAL|LINT_TO_LREAL|LINT_TO_TIME|LINT_TO_DATE|LINT_TO_TOD|LINT_TO_DT|LINT_TO_STRING|LINT_TO_BYTE|LINT_TO_WORD|LINT_TO_DWORD|LINT_TO_LWORD|USINT_TO_BOOL|USINT_TO_SINT|USINT_TO_INT|USINT_TO_DINT|USINT_TO_LINT|USINT_TO_UINT|USINT_TO_UDINT|USINT_TO_ULINT|USINT_TO_REAL|USINT_TO_LREAL|USINT_TO_TIME|USINT_TO_DATE|USINT_TO_TOD|USINT_TO_DT|USINT_TO_STRING|USINT_TO_BYTE|USINT_TO_WORD|USINT_TO_DWORD|USINT_TO_LWORD|UINT_TO_BOOL|UINT_TO_SINT|UINT_TO_INT|UINT_TO_DINT|UINT_TO_LINT|UINT_TO_USINT|UINT_TO_UDINT|UINT_TO_ULINT|UINT_TO_REAL|UINT_TO_LREAL|UINT_TO_TIME|UINT_TO_DATE|UINT_TO_TOD|UINT_TO_DT|UINT_TO_STRING|UINT_TO_BYTE|UINT_TO_WORD|UINT_TO_DWORD|UINT_TO_LWORD|UDINT_TO_BOOL|UDINT_TO_SINT|UDINT_TO_INT|UDINT_TO_DINT|UDINT_TO_LINT|UDINT_TO_USINT|UDINT_TO_UINT|UDINT_TO_ULINT|UDINT_TO_REAL|UDINT_TO_LREAL|UDINT_TO_TIME|UDINT_TO_DATE|UDINT_TO_TOD|UDINT_TO_DT|UDINT_TO_STRING|UDINT_TO_BYTE|UDINT_TO_WORD|UDINT_TO_DWORD|UDINT_TO_LWORD|ULINT_TO_BOOL|ULINT_TO_SINT|ULINT_TO_INT|ULINT_TO_DINT|ULINT_TO_LINT|ULINT_TO_USINT|ULINT_TO_UINT|ULINT_TO_UDINT|ULINT_TO_REAL|ULINT_TO_LREAL|ULINT_TO_TIME|ULINT_TO_DATE|ULINT_TO_TOD|ULINT_TO_DT|ULINT_TO_STRING|ULINT_TO_BYTE|ULINT_TO_WORD|ULINT_TO_DWORD|ULINT_TO_LWORD|REAL_TO_BOOL|REAL_TO_SINT|REAL_TO_INT|REAL_TO_DINT|REAL_TO_LINT|REAL_TO_USINT|REAL_TO_UINT|REAL_TO_UDINT|REAL_TO_ULINT|REAL_TO_LREAL|REAL_TO_TIME|REAL_TO_DATE|REAL_TO_TOD|REAL_TO_DT|REAL_TO_STRING|REAL_TO_BYTE|REAL_TO_WORD|REAL_TO_DWORD|REAL_TO_LWORD|LREAL_TO_BOOL|LREAL_TO_SINT|LREAL_TO_INT|LREAL_TO_DINT|LREAL_TO_LINT|LREAL_TO_USINT|LREAL_TO_UINT|LREAL_TO_UDINT|LREAL_TO_ULINT|LREAL_TO_REAL|LREAL_TO_TIME|LREAL_TO_DATE|LREAL_TO_TOD|LREAL_TO_DT|LREAL_TO_STRING|LREAL_TO_BYTE|LREAL_TO_WORD|LREAL_TO_DWORD|LREAL_TO_LWORD|TIME_TO_SINT|TIME_TO_INT|TIME_TO_DINT|TIME_TO_LINT|TIME_TO_USINT|TIME_TO_UINT|TIME_TO_UDINT|TIME_TO_ULINT|TIME_TO_REAL|TIME_TO_LREAL|TIME_TO_STRING|TIME_TO_BYTE|TIME_TO_WORD|TIME_TO_DWORD|TIME_TO_LWORD|DATE_TO_SINT|DATE_TO_INT|DATE_TO_DINT|DATE_TO_LINT|DATE_TO_USINT|DATE_TO_UINT|DATE_TO_UDINT|DATE_TO_ULINT|DATE_TO_REAL|DATE_TO_LREAL|DATE_TO_STRING|DATE_TO_BYTE|DATE_TO_WORD|DATE_TO_DWORD|DATE_TO_LWORD|TOD_TO_SINT|TOD_TO_INT|TOD_TO_DINT|TOD_TO_LINT|TOD_TO_USINT|TOD_TO_UINT|TOD_TO_UDINT|TOD_TO_ULINT|TOD_TO_REAL|TOD_TO_LREAL|TOD_TO_STRING|TOD_TO_BYTE|TOD_TO_WORD|TOD_TO_DWORD|TOD_TO_LWORD|DT_TO_SINT|DT_TO_INT|DT_TO_DINT|DT_TO_LINT|DT_TO_USINT|DT_TO_UINT|DT_TO_UDINT|DT_TO_ULINT|DT_TO_REAL|DT_TO_LREAL|DT_TO_STRING|DT_TO_BYTE|DT_TO_WORD|DT_TO_DWORD|DT_TO_LWORD|STRING_TO_BOOL|STRING_TO_SINT|STRING_TO_INT|STRING_TO_DINT|STRING_TO_LINT|STRING_TO_USINT|STRING_TO_UINT|STRING_TO_UDINT|STRING_TO_ULINT|STRING_TO_REAL|STRING_TO_LREAL|STRING_TO_TIME|STRING_TO_DATE|STRING_TO_TOD|STRING_TO_DT|STRING_TO_BYTE|STRING_TO_WORD|STRING_TO_DWORD|STRING_TO_LWORD|BYTE_TO_BOOL|BYTE_TO_SINT|BYTE_TO_INT|BYTE_TO_DINT|BYTE_TO_LINT|BYTE_TO_USINT|BYTE_TO_UINT|BYTE_TO_UDINT|BYTE_TO_ULINT|BYTE_TO_REAL|BYTE_TO_LREAL|BYTE_TO_TIME|BYTE_TO_DATE|BYTE_TO_TOD|BYTE_TO_DT|BYTE_TO_STRING|BYTE_TO_WORD|BYTE_TO_DWORD|BYTE_TO_LWORD|WORD_TO_BOOL|WORD_TO_SINT|WORD_TO_INT|WORD_TO_DINT|WORD_TO_LINT|WORD_TO_USINT|WORD_TO_UINT|WORD_TO_UDINT|WORD_TO_ULINT|WORD_TO_REAL|WORD_TO_LREAL|WORD_TO_TIME|WORD_TO_DATE|WORD_TO_TOD|WORD_TO_DT|WORD_TO_STRING|WORD_TO_BYTE|WORD_TO_DWORD|WORD_TO_LWORD|DWORD_TO_BOOL|DWORD_TO_SINT|DWORD_TO_INT|DWORD_TO_DINT|DWORD_TO_LINT|DWORD_TO_USINT|DWORD_TO_UINT|DWORD_TO_UDINT|DWORD_TO_ULINT|DWORD_TO_REAL|DWORD_TO_LREAL|DWORD_TO_TIME|DWORD_TO_DATE|DWORD_TO_TOD|DWORD_TO_DT|DWORD_TO_STRING|DWORD_TO_BYTE|DWORD_TO_WORD|DWORD_TO_LWORD|LWORD_TO_BOOL|LWORD_TO_SINT|LWORD_TO_INT|LWORD_TO_DINT|LWORD_TO_LINT|LWORD_TO_USINT|LWORD_TO_UINT|LWORD_TO_UDINT|LWORD_TO_ULINT|LWORD_TO_REAL|LWORD_TO_LREAL|LWORD_TO_TIME|LWORD_TO_DATE|LWORD_TO_TOD|LWORD_TO_DT|LWORD_TO_STRING|LWORD_TO_BYTE|LWORD_TO_WORD|LWORD_TO_DWORD|TRUNC|BCD_TO_USINT|BCD_TO_UINT|BCD_TO_UDINT|BCD_TO_ULINT|USINT_TO_BCD|UINT_TO_BCD|UDINT_TO_BCD|ULINT_TO_BCD|DATE_AND_TIME_TO_TIME_OF_DAY|DATE_AND_TIME_TO_DATE|ABS|SQRT|LOG|ASIN|ACOS|ATAN|SIN|COS|TAN|ADD_TIME|ADD_TOD_TIME|ADD_DT_TIME|MULTIME|SUB_TIME|SUB_DATE_DATE|SUB_TOD_TIME|SUB_TOD_TOD|SUB_DT_TIME|SUB_DT_DT|DIVTIME|SHL|SHR|ROR|ROL|CONCAT_DATE_TOD|CTU_DINT|CTU_LINT|CTU_UDINT|CTU_ULINT|CTD_DINT|CTD_LINT|CTD_UDINT|CTD_ULIN|CTUD_DINT|CTUD_LINT|CTUD_UDINT|CTUD_ULINT|TP|TON|TOF|CTUD|CTU|CTD|SEMA|MC_Power|MC_ReadActualPosition|MC_MoveAbsolute|MC_MoveRelative|MC_MoveAdditive|MC_MoveSuperImposed|MC_MoveVelocity|MC_PositionProfile|MC_VelocityProfile|MC_ReadActualVelocity|MC_AccelerationProfile|MC_SetPosition|MC_ReadParameter|MC_ReadBoolParameter|MC_WriteParameter|MC_WriteBoolParameter|MC_ReadActualTorque|MC_ReadStatus|MC_ReadAxisError|MC_Reset|MC_DigitalCamSwitch|MC_TouchProbe|MC_AbortTrigger|MC_Stop|MC_Halt|MC_Home|MC_CamTableSelect|MC_CamIn|MC_CamOut|MC_GearIn|MC_GearOut|MC_GearInPos|MC_Phasing|SMC_TrackAxis|SMC_TrackSetValues|MC_StartTrace|SMC_MoveContinuousAbsolute|SMC_MoveContinuousRelative|SMC_GetTappetValue|SMC_ReadAxisInfo|SMC_GetTimeNS|SMC_ParameterNumber_CoE|SMC_ERROR|MC_Direction|MC_BUFFER_MODE|SMC_AXIS_STATE|MC_TAPPETMODE|SMC_CAM_TYPE|MC_STARTMODE|AXIS_REF|MC_CAM_REF|SMC_TP|MC_TP_REF|SMC_TV|MC_TV_REF|SMC_TA|MC_TA_REF|AXIS_REF_SM3|MC_CAMSWITCH_TR|MC_CAMSWITCH_REF|MC_TRACK_TR|TRIGGER_REF|MC_CAM_REF1|MC_CAM_ID|SMC_TAPPETDATA|Axis_Ref_Info)\\\\b/i"
      },
      "fragment": false,
      "hidden": false
    },
    {
      "$type": "TerminalRule",
      "name": "Real_type_name",
      "definition": {
        "$type": "RegexToken",
        "regex": "/\\\\b(?:LREAL|REAL)\\\\b/i"
      },
      "fragment": false,
      "hidden": false
    },
    {
      "$type": "TerminalRule",
      "name": "Unsigned_integer_type_name",
      "definition": {
        "$type": "RegexToken",
        "regex": "/\\\\b(?:USINT|UINT|UDINT|ULINT)\\\\b/i"
      },
      "fragment": false,
      "hidden": false
    },
    {
      "$type": "TerminalRule",
      "name": "Bit_string_type_name",
      "definition": {
        "$type": "RegexToken",
        "regex": "/\\\\b(?:BYTE|WORD|DWORD|LWORD)\\\\b/i"
      },
      "fragment": false,
      "hidden": false
    },
    {
      "$type": "TerminalRule",
      "name": "Bool_Result_type_name",
      "definition": {
        "$type": "RegexToken",
        "regex": "/\\\\b(?:TRUE|FALSE)\\\\b/i"
      },
      "fragment": false,
      "hidden": false
    },
    {
      "$type": "TerminalRule",
      "name": "Bool_type_name",
      "definition": {
        "$type": "RegexToken",
        "regex": "/\\\\b(?:BOOL)\\\\b/i"
      },
      "fragment": false,
      "hidden": false
    },
    {
      "$type": "TerminalRule",
      "name": "String_type_name",
      "definition": {
        "$type": "RegexToken",
        "regex": "/\\\\b(?:STRING)\\\\b/i"
      },
      "fragment": false,
      "hidden": false
    },
    {
      "$type": "TerminalRule",
      "name": "Date_And_time_type_name",
      "definition": {
        "$type": "RegexToken",
        "regex": "/\\\\b(?:DATE_AND_TIME)\\\\b/i"
      },
      "fragment": false,
      "hidden": false
    },
    {
      "$type": "TerminalRule",
      "name": "Time_Of_Day_type_name",
      "definition": {
        "$type": "RegexToken",
        "regex": "/\\\\b(?:TIME_OF_DAY)\\\\b/i"
      },
      "fragment": false,
      "hidden": false
    },
    {
      "$type": "TerminalRule",
      "name": "Time_type_name",
      "definition": {
        "$type": "RegexToken",
        "regex": "/\\\\b(?:TIME)\\\\b/i"
      },
      "fragment": false,
      "hidden": false
    },
    {
      "$type": "TerminalRule",
      "name": "Date_type_name",
      "definition": {
        "$type": "RegexToken",
        "regex": "/\\\\b(?:DATE)\\\\b/i"
      },
      "fragment": false,
      "hidden": false
    },
    {
      "$type": "TerminalRule",
      "name": "Any_type_name",
      "definition": {
        "$type": "RegexToken",
        "regex": "/\\\\b(?:ANY|ANY_DERIVED|ANY_ELEMENTARY|ANY_MAGNITUDE|ANY_NUM|ANY_REAL|ANY_INT|ANY_BIT|ANY_NBIT|ANY_STRING|ANY_DATE)\\\\b/i"
      },
      "fragment": false,
      "hidden": false
    },
    {
      "$type": "TerminalRule",
      "name": "Identifier",
      "definition": {
        "$type": "RegexToken",
        "regex": "/[_a-zA-Z][\\\\w_]*/"
      },
      "fragment": false,
      "hidden": false
    },
    {
      "$type": "TerminalRule",
      "fragment": true,
      "name": "Exponent_prefix",
      "definition": {
        "$type": "RegexToken",
        "regex": "/[Ee]/"
      },
      "hidden": false
    },
    {
      "$type": "TerminalRule",
      "name": "Exponent",
      "definition": {
        "$type": "TerminalGroup",
        "elements": [
          {
            "$type": "TerminalRuleCall",
            "rule": {
              "$ref": "#/rules@120"
            }
          },
          {
            "$type": "TerminalAlternatives",
            "elements": [
              {
                "$type": "CharacterRange",
                "left": {
                  "$type": "Keyword",
                  "value": "+"
                }
              },
              {
                "$type": "CharacterRange",
                "left": {
                  "$type": "Keyword",
                  "value": "-"
                }
              }
            ],
            "cardinality": "?"
          },
          {
            "$type": "TerminalRuleCall",
            "rule": {
              "$ref": "#/rules@140"
            }
          }
        ]
      },
      "fragment": false,
      "hidden": false
    },
    {
      "$type": "TerminalRule",
      "name": "Binary_integer",
      "definition": {
        "$type": "RegexToken",
        "regex": "/\\\\b2#(0|1)(0|1|(_))*\\\\b/"
      },
      "fragment": false,
      "hidden": false
    },
    {
      "$type": "TerminalRule",
      "name": "Hex_integer",
      "definition": {
        "$type": "RegexToken",
        "regex": "/\\\\b16#([0-9aAbBcCdDeEfF])([0-9aAbBcCdDeEfF]|(_))*\\\\b/"
      },
      "fragment": false,
      "hidden": false
    },
    {
      "$type": "TerminalRule",
      "name": "Octal_integer",
      "definition": {
        "$type": "RegexToken",
        "regex": "/\\\\b8#([0-7])([0-7]|(_))*\\\\b/"
      },
      "fragment": false,
      "hidden": false
    },
    {
      "$type": "TerminalRule",
      "name": "Single_byte_character_string",
      "definition": {
        "$type": "RegexToken",
        "regex": "/(')(\\\\\\\\.|[^'])*(')/"
      },
      "fragment": false,
      "hidden": false
    },
    {
      "$type": "TerminalRule",
      "name": "Double_byte_character_string",
      "definition": {
        "$type": "RegexToken",
        "regex": "/(\\")(\\\\\\\\.|[^\\"])*(\\")/"
      },
      "fragment": false,
      "hidden": false
    },
    {
      "$type": "TerminalRule",
      "name": "TMilliseconds",
      "definition": {
        "$type": "TerminalGroup",
        "elements": [
          {
            "$type": "TerminalRuleCall",
            "rule": {
              "$ref": "#/rules@132"
            },
            "cardinality": "?"
          },
          {
            "$type": "TerminalRuleCall",
            "rule": {
              "$ref": "#/rules@134"
            }
          },
          {
            "$type": "RegexToken",
            "regex": "/[mM][sS]/"
          }
        ]
      },
      "fragment": false,
      "hidden": false
    },
    {
      "$type": "TerminalRule",
      "name": "TMinutes",
      "definition": {
        "$type": "TerminalGroup",
        "elements": [
          {
            "$type": "TerminalRuleCall",
            "rule": {
              "$ref": "#/rules@132"
            },
            "cardinality": "?"
          },
          {
            "$type": "TerminalRuleCall",
            "rule": {
              "$ref": "#/rules@134"
            }
          },
          {
            "$type": "RegexToken",
            "regex": "/[mM]/"
          }
        ]
      },
      "fragment": false,
      "hidden": false
    },
    {
      "$type": "TerminalRule",
      "name": "TSeconds",
      "definition": {
        "$type": "TerminalGroup",
        "elements": [
          {
            "$type": "TerminalRuleCall",
            "rule": {
              "$ref": "#/rules@132"
            },
            "cardinality": "?"
          },
          {
            "$type": "TerminalRuleCall",
            "rule": {
              "$ref": "#/rules@134"
            }
          },
          {
            "$type": "RegexToken",
            "regex": "/[sS]/"
          }
        ]
      },
      "fragment": false,
      "hidden": false
    },
    {
      "$type": "TerminalRule",
      "name": "TDays",
      "definition": {
        "$type": "TerminalGroup",
        "elements": [
          {
            "$type": "TerminalRuleCall",
            "rule": {
              "$ref": "#/rules@132"
            },
            "cardinality": "?"
          },
          {
            "$type": "TerminalRuleCall",
            "rule": {
              "$ref": "#/rules@134"
            }
          },
          {
            "$type": "RegexToken",
            "regex": "/[dD]/"
          }
        ]
      },
      "fragment": false,
      "hidden": false
    },
    {
      "$type": "TerminalRule",
      "name": "THours",
      "definition": {
        "$type": "TerminalGroup",
        "elements": [
          {
            "$type": "TerminalRuleCall",
            "rule": {
              "$ref": "#/rules@134"
            }
          },
          {
            "$type": "RegexToken",
            "regex": "/[hH]/"
          }
        ]
      },
      "fragment": false,
      "hidden": false
    },
    {
      "$type": "TerminalRule",
      "fragment": true,
      "name": "Underscore",
      "definition": {
        "$type": "RegexToken",
        "regex": "/_/"
      },
      "hidden": false
    },
    {
      "$type": "TerminalRule",
      "fragment": true,
      "name": "Letters",
      "definition": {
        "$type": "RegexToken",
        "regex": "/[a-zA-Z]+/"
      },
      "hidden": false
    },
    {
      "$type": "TerminalRule",
      "fragment": true,
      "name": "Fixed_point",
      "definition": {
        "$type": "TerminalGroup",
        "elements": [
          {
            "$type": "TerminalRuleCall",
            "rule": {
              "$ref": "#/rules@140"
            }
          },
          {
            "$type": "TerminalGroup",
            "elements": [
              {
                "$type": "CharacterRange",
                "left": {
                  "$type": "Keyword",
                  "value": "."
                }
              },
              {
                "$type": "TerminalRuleCall",
                "rule": {
                  "$ref": "#/rules@140"
                }
              }
            ],
            "cardinality": "?"
          }
        ]
      },
      "hidden": false
    },
    {
      "$type": "TerminalRule",
      "fragment": true,
      "name": "Location_prefix",
      "definition": {
        "$type": "TerminalAlternatives",
        "elements": [
          {
            "$type": "TerminalAlternatives",
            "elements": [
              {
                "$type": "CharacterRange",
                "left": {
                  "$type": "Keyword",
                  "value": "I"
                }
              },
              {
                "$type": "CharacterRange",
                "left": {
                  "$type": "Keyword",
                  "value": "Q"
                }
              }
            ]
          },
          {
            "$type": "CharacterRange",
            "left": {
              "$type": "Keyword",
              "value": "M"
            }
          }
        ]
      },
      "hidden": false
    },
    {
      "$type": "TerminalRule",
      "fragment": true,
      "name": "Size_prefix",
      "definition": {
        "$type": "TerminalAlternatives",
        "elements": [
          {
            "$type": "TerminalAlternatives",
            "elements": [
              {
                "$type": "TerminalAlternatives",
                "elements": [
                  {
                    "$type": "TerminalAlternatives",
                    "elements": [
                      {
                        "$type": "CharacterRange",
                        "left": {
                          "$type": "Keyword",
                          "value": "X"
                        }
                      },
                      {
                        "$type": "CharacterRange",
                        "left": {
                          "$type": "Keyword",
                          "value": "B"
                        }
                      }
                    ]
                  },
                  {
                    "$type": "CharacterRange",
                    "left": {
                      "$type": "Keyword",
                      "value": "W"
                    }
                  }
                ]
              },
              {
                "$type": "CharacterRange",
                "left": {
                  "$type": "Keyword",
                  "value": "D"
                }
              }
            ]
          },
          {
            "$type": "CharacterRange",
            "left": {
              "$type": "Keyword",
              "value": "L"
            }
          }
        ]
      },
      "hidden": false
    },
    {
      "$type": "TerminalRule",
      "name": "ADDRESS",
      "definition": {
        "$type": "TerminalGroup",
        "elements": [
          {
            "$type": "CharacterRange",
            "left": {
              "$type": "Keyword",
              "value": "%"
            }
          },
          {
            "$type": "TerminalAlternatives",
            "elements": [
              {
                "$type": "TerminalAlternatives",
                "elements": [
                  {
                    "$type": "CharacterRange",
                    "left": {
                      "$type": "Keyword",
                      "value": "I"
                    }
                  },
                  {
                    "$type": "CharacterRange",
                    "left": {
                      "$type": "Keyword",
                      "value": "Q"
                    }
                  }
                ]
              },
              {
                "$type": "CharacterRange",
                "left": {
                  "$type": "Keyword",
                  "value": "M"
                }
              }
            ]
          },
          {
            "$type": "TerminalAlternatives",
            "elements": [
              {
                "$type": "TerminalAlternatives",
                "elements": [
                  {
                    "$type": "TerminalAlternatives",
                    "elements": [
                      {
                        "$type": "TerminalAlternatives",
                        "elements": [
                          {
                            "$type": "CharacterRange",
                            "left": {
                              "$type": "Keyword",
                              "value": "X"
                            },
                            "cardinality": "?"
                          },
                          {
                            "$type": "CharacterRange",
                            "left": {
                              "$type": "Keyword",
                              "value": "B"
                            }
                          }
                        ]
                      },
                      {
                        "$type": "CharacterRange",
                        "left": {
                          "$type": "Keyword",
                          "value": "W"
                        }
                      }
                    ]
                  },
                  {
                    "$type": "CharacterRange",
                    "left": {
                      "$type": "Keyword",
                      "value": "D"
                    }
                  }
                ]
              },
              {
                "$type": "CharacterRange",
                "left": {
                  "$type": "Keyword",
                  "value": "L"
                }
              }
            ]
          },
          {
            "$type": "TerminalRuleCall",
            "rule": {
              "$ref": "#/rules@138"
            }
          },
          {
            "$type": "TerminalGroup",
            "elements": [
              {
                "$type": "CharacterRange",
                "left": {
                  "$type": "Keyword",
                  "value": "."
                }
              },
              {
                "$type": "TerminalRuleCall",
                "rule": {
                  "$ref": "#/rules@138"
                }
              }
            ],
            "cardinality": "*"
          }
        ]
      },
      "fragment": false,
      "hidden": false
    },
    {
      "$type": "TerminalRule",
      "name": "Digits",
      "definition": {
        "$type": "RegexToken",
        "regex": "/[0-9]+/"
      },
      "fragment": false,
      "hidden": false
    },
    {
      "$type": "TerminalRule",
      "name": "Direct_variable_prefix",
      "definition": {
        "$type": "TerminalGroup",
        "elements": [
          {
            "$type": "CharacterRange",
            "left": {
              "$type": "Keyword",
              "value": "%"
            }
          },
          {
            "$type": "TerminalRuleCall",
            "rule": {
              "$ref": "#/rules@135"
            }
          },
          {
            "$type": "TerminalRuleCall",
            "rule": {
              "$ref": "#/rules@136"
            }
          },
          {
            "$type": "TerminalGroup",
            "elements": [
              {
                "$type": "TerminalRuleCall",
                "rule": {
                  "$ref": "#/rules@140"
                }
              },
              {
                "$type": "TerminalGroup",
                "elements": [
                  {
                    "$type": "CharacterRange",
                    "left": {
                      "$type": "Keyword",
                      "value": "."
                    }
                  },
                  {
                    "$type": "TerminalRuleCall",
                    "rule": {
                      "$ref": "#/rules@140"
                    }
                  }
                ],
                "cardinality": "*"
              }
            ],
            "cardinality": "*"
          }
        ]
      },
      "fragment": false,
      "hidden": false
    },
    {
      "$type": "TerminalRule",
      "name": "Integer",
      "definition": {
        "$type": "TerminalGroup",
        "elements": [
          {
            "$type": "TerminalRuleCall",
            "rule": {
              "$ref": "#/rules@138"
            }
          },
          {
            "$type": "TerminalGroup",
            "elements": [
              {
                "$type": "TerminalRuleCall",
                "rule": {
                  "$ref": "#/rules@132"
                },
                "cardinality": "?"
              },
              {
                "$type": "TerminalRuleCall",
                "rule": {
                  "$ref": "#/rules@138"
                }
              }
            ],
            "cardinality": "*"
          }
        ]
      },
      "fragment": false,
      "hidden": false
    },
    {
      "$type": "TerminalRule",
      "name": "IdentifierEnumeratedCase",
      "definition": {
        "$type": "TerminalGroup",
        "elements": [
          {
            "$type": "TerminalAlternatives",
            "elements": [
              {
                "$type": "TerminalGroup",
                "elements": [
                  {
                    "$type": "TerminalRuleCall",
                    "rule": {
                      "$ref": "#/rules@132"
                    }
                  },
                  {
                    "$type": "TerminalAlternatives",
                    "elements": [
                      {
                        "$type": "TerminalRuleCall",
                        "rule": {
                          "$ref": "#/rules@138"
                        }
                      },
                      {
                        "$type": "TerminalRuleCall",
                        "rule": {
                          "$ref": "#/rules@133"
                        }
                      }
                    ]
                  }
                ]
              },
              {
                "$type": "TerminalRuleCall",
                "rule": {
                  "$ref": "#/rules@133"
                }
              }
            ]
          },
          {
            "$type": "TerminalGroup",
            "elements": [
              {
                "$type": "TerminalRuleCall",
                "rule": {
                  "$ref": "#/rules@132"
                },
                "cardinality": "?"
              },
              {
                "$type": "TerminalAlternatives",
                "elements": [
                  {
                    "$type": "TerminalRuleCall",
                    "rule": {
                      "$ref": "#/rules@138"
                    }
                  },
                  {
                    "$type": "TerminalRuleCall",
                    "rule": {
                      "$ref": "#/rules@133"
                    }
                  }
                ]
              }
            ],
            "cardinality": "*"
          },
          {
            "$type": "RegexToken",
            "regex": "/(?=(,\\\\s*([_A-Za-z]\\\\w*|([+\\\\-]?[0-9][0-9_]*\\\\s*(\\\\.\\\\.\\\\s*[+\\\\-]?[0-9][0-9_]*)?))\\\\s*)*\\\\:\\\\s+)/"
          }
        ]
      },
      "fragment": false,
      "hidden": false
    },
    {
      "$type": "TerminalRule",
      "hidden": true,
      "name": "WS",
      "definition": {
        "$type": "RegexToken",
        "regex": "/\\\\s+/"
      },
      "fragment": false
    },
    {
      "$type": "TerminalRule",
      "hidden": true,
      "name": "ML_COMMENT",
      "definition": {
        "$type": "RegexToken",
        "regex": "/\\\\/\\\\*[\\\\s\\\\S]*?\\\\*\\\\//"
      },
      "fragment": false
    },
    {
      "$type": "TerminalRule",
      "hidden": true,
      "name": "ML_COMMENT_ST",
      "definition": {
        "$type": "RegexToken",
        "regex": "/\\\\(\\\\*[\\\\s\\\\S]*?\\\\*\\\\)/"
      },
      "fragment": false
    },
    {
      "$type": "TerminalRule",
      "hidden": true,
      "name": "SL_COMMENT",
      "definition": {
        "$type": "RegexToken",
        "regex": "/\\\\/\\\\/[^\\\\n\\\\r]*/"
      },
      "fragment": false
    }
  ],
  "types": [
    {
      "$type": "Type",
      "name": "Universe",
      "type": {
        "$type": "UnionType",
        "types": [
          {
            "$type": "SimpleType",
            "typeRef": {
              "$ref": "#/types@2"
            }
          },
          {
            "$type": "SimpleType",
            "typeRef": {
              "$ref": "#/rules@4"
            }
          }
        ]
      }
    },
    {
      "$type": "Type",
      "name": "VariableReferenceTarget",
      "type": {
        "$type": "UnionType",
        "types": [
          {
            "$type": "SimpleType",
            "typeRef": {
              "$ref": "#/types@2"
            }
          },
          {
            "$type": "SimpleType",
            "typeRef": {
              "$ref": "#/rules@1"
            }
          },
          {
            "$type": "SimpleType",
            "typeRef": {
              "$ref": "#/rules@4"
            }
          }
        ]
      }
    },
    {
      "$type": "Type",
      "name": "NamedElement",
      "type": {
        "$type": "UnionType",
        "types": [
          {
            "$type": "SimpleType",
            "typeRef": {
              "$ref": "#/rules@19/definition/elements@0/inferredType"
            }
          },
          {
            "$type": "SimpleType",
            "typeRef": {
              "$ref": "#/rules@20/inferredType"
            }
          }
        ]
      }
    }
  ],
  "definesHiddenTokens": false,
  "hiddenTokens": [],
  "imports": [],
  "interfaces": [],
  "usedGrammars": []
}`);var ZG={languageId:"st",fileExtensions:[".st"],caseInsensitive:!1},Tb={AstReflection:()=>new Fu},yb={Grammar:()=>gb(),LanguageMetaData:()=>ZG,parser:{}};var Gp=class{constructor(e){this.services=e}error(e){var r;e&&((r=this.services.lsp.Connection)==null||r.console.error(e))}warn(e){var r;e&&((r=this.services.lsp.Connection)==null||r.console.warn(e))}info(e){var r;e&&((r=this.services.lsp.Connection)==null||r.console.info(e))}log(e){var r;e&&((r=this.services.lsp.Connection)==null||r.console.log(e))}};var jp=class extends os{getSource(){return"st-analyze"}};var _b=yt(require("path"),1);var qp=class extends Jo{getName(e){return Uu(e)?__(e):super.getName(e)}getNameNode(e){return Uu(e)?e.$cstNode:super.getNameNode(e)}};function __(t){let e=Qt.getDocument(t);return _b.default.posix.basename(e.uri.path).replace(/\.st$/i,"")}var vb=yt(Or(),1),Hp=class extends ss{constructor(e){super(e),this.indexManager=e.shared.workspace.IndexManager}async createDescriptions(e,r=vb.CancellationToken.None){let n=await super.createDescriptions(e,r),i=e.parseResult.value,o=this.getGlobalVarListDescriptions(i);return o.length===0||this.collectExternalDeclarations(i).forEach(a=>{a.$cstNode&&o.forEach(l=>{n.push({sourceUri:e.uri,sourcePath:this.nodeLocator.getAstNodePath(a),targetUri:l.documentUri,targetPath:l.path,segment:this.toDocumentSegment(a.$cstNode),local:l.documentUri.toString()===e.uri.toString()})})}),n}collectExternalDeclarations(e){let r=[];return e.program.forEach(n=>{r.push(...this.getProgramExternalDeclarations(n))}),e.function_block.forEach(n=>{n.varExternals.forEach(i=>r.push(...i.items))}),r}getProgramExternalDeclarations(e){let r=[],n=new Set;return e.inputs.filter(i=>i.definition==="VAR_EXTERNAL").forEach(i=>{i.items.forEach(o=>{n.has(o)||(n.add(o),r.push(o))})}),e.varExternals.forEach(i=>{i.items.forEach(o=>{n.has(o)||(n.add(o),r.push(o))})}),r}getGlobalVarListDescriptions(e){let r=[...this.indexManager.allElements("GlobalVarList").toArray()];return e.globalVarLists.forEach(n=>{var s,a;if(!n.$document)return;let i=this.nodeLocator.getAstNodePath(n);r.find(l=>{var u;return l.documentUri.toString()===((u=n.$document)==null?void 0:u.uri.toString())&&l.path===i})||r.push({node:n,name:"",documentUri:n.$document.uri,path:i,nameSegment:this.toDocumentSegment((s=n.$cstNode)!=null?s:n.$document.parseResult.value.$cstNode),selectionSegment:this.toDocumentSegment((a=n.$cstNode)!=null?a:n.$document.parseResult.value.$cstNode),type:"GlobalVarList"})}),r.filter(n=>n.type==="GlobalVarList")}toDocumentSegment(e){return{range:e.range,offset:e.offset,length:e.length,end:e.end}}};var Kp=class extends es{async computeLocalScopes(e,r){let n=e.parseResult.value,i=new hn;for(let a of n.program)a.inputs.forEach(u=>{u.items.forEach(f=>{let d=this.descriptions.createDescription(f,f.variables,e);i.add(n,d);let m=f.nextVariables;this.addNextVariables(m,f,e,i,n)})}),this.handleExternalVariables(a.varExternals,i,n,e);for(let a of n.globalVarLists){let l=this.descriptions.createDescription(a,__(a),e);i.add(n,l)}return n.function_block.forEach(a=>{let l=a.varInputs,u=a.varOutputs,c=a.varLocals,f=a.varExternals;this.handleAllVariable(l,i,n,e),this.handleAllVariable(u,i,n,e),this.handleAllVariable(c,i,n,e),this.handleExternalVariables(f,i,n,e)}),n.st_function.forEach(a=>{let l=a.varInputs,u=a.varOutputs,c=a.varLocals;this.handleAllVariable(l,i,n,e),this.handleAllVariable(u,i,n,e),this.handleAllVariable(c,i,n,e)}),i}addNextVariables(e,r,n,i,o){if(e)return e.length>0&&e.forEach(s=>{let a=this.descriptions.createDescription(r,s,n);i.add(o,a)}),i}handleAllVariable(e,r,n,i){e.forEach(o=>{o.items.forEach(a=>{let l=this.descriptions.createDescription(a,a.variables,i);r.add(n,l),this.addNextVariables(a.nextVariables,a,i,r,n)})})}handleExternalVariables(e,r,n,i){e.forEach(o=>{o.items.forEach(a=>{let l=this.descriptions.createDescription(a,a.variables,i);r.add(n,l),this.addNextVariables(a.nextVariables,a,i,r,n)})})}};var zp=class extends Ep{format(e){}};var Yp=class extends Xo{constructor(r){super(r);this.services=r}getOuterCacheElement(r){return YC(r)}isOuterCacheReference(r){return this.getOuterCacheElement(r)!==void 0}createOuterCacheDescription(r){let n=this.getOuterCacheElement(r),i="FunctionElement";return n&&(n.elementType==="alias"?i="Alias":n.elementType==="enum"?i="StEnum":n.elementType==="struct"?i="StructsList":n.elementType==="functionBlock"&&(i="FunctionBlock")),{type:i,name:r,documentUri:pr,path:"st-cache"}}getCandidate(r){let n=r.reference.$refText,i=this.reflection.getReferenceType(r);return Pp.includes(n.toUpperCase())?this.createOuterCacheDescription(n):(i==="ComposeElement"||i==="Universe")&&this.isOuterCacheReference(n)?this.createOuterCacheDescription(n):super.getCandidate(r)}buildReference(r,n,i,o){let s=this,a={$refNode:i,$refText:o,get ref(){var l;if(Be(this._ref))return this._ref;if(_l(this._nodeDescription)){let u=s.loadAstNode(this._nodeDescription),c=s.getOuterCacheElement(o);this._ref=u!=null?u:c,!this._ref&&!Pp.includes(o.toUpperCase())&&(this._ref=s.createLinkingError({reference:a,container:r,property:n},this._nodeDescription))}else if(this._ref===void 0){let u=s.getLinkedNode({reference:a,container:r,property:n});if(u.error&&Qt.getDocument(r).state<ae.ComputedScopes)return;this._ref=(l=u.node)!=null?l:u.error,this._nodeDescription=u.descr}return Be(this._ref)?this._ref:void 0},get $nodeDescription(){return this._nodeDescription},get error(){return Nn(this._ref)?this._ref:void 0}};return a}doLink(r,n){let i=r.reference;if(i._ref===void 0)try{let o=this.getCandidate(r);if(Nn(o))i._ref=o;else if(i._nodeDescription=o,this.langiumDocuments().hasDocument(o.documentUri)){let s=this.loadAstNode(o),a=this.getOuterCacheElement(i.$refText);s||a?i._ref=s!=null?s:a:o.documentUri.toString()!==n.uri.toString()&&(i._ref=this.createLinkingError(r,o))}}catch(o){i._ref={...r,message:`An error occurred while resolving reference to '${i.$refText}': ${o}`}}n.references.push(i)}getLinkedNode(r){try{let n=this.getCandidate(r);if(Nn(n))return{error:n};let i=this.loadAstNode(n);if(i)return{node:i,descr:n};let o=this.getOuterCacheElement(r.reference.$refText);return o?{node:o,descr:n}:n.documentUri.toString()===Qt.getDocument(r.container).uri.toString()?{descr:n}:{descr:n,error:this.createLinkingError(r,n)}}catch(n){return{error:{...r,message:`An error occurred while resolving reference to '${r.reference.$refText}': ${n}`}}}}createLinkingError(r,n){let i=Qt.getDocument(r.container);i.state<ae.ComputedScopes&&console.warn(`Attempted reference resolution before document reached ComputedScopes state (${i.uri}).`);let o=this.reflection.getReferenceType(r),s=r.container;return $C(s)?(o="\u529F\u80FD\u5757\u6216\u51FD\u6570",{...r,message:`\u4E0D\u80FD\u5F15\u7528\u7684${o}'${r.reference.$refText}'.`,targetDescription:n}):{...r,message:`Could not resolve reference to ${o} named '${r.reference.$refText}'.`,targetDescription:n}}};function Rb(t){return{$type:"struct",literal:t}}function xb(t){return t.$type==="struct"}function Nb(t){return{$type:"globalVarList",literal:t}}function Eb(t){return t.$type==="globalVarList"}function Ib(t){return{$type:"functionBlock",literal:t}}function Ob(t){return t.$type==="functionBlock"}function ju(t,e){return{$type:"error",message:t,source:e}}function Ab(t){return{$type:"cache",literal:t}}function Sb(t){return t.$type==="cache"}function ds(t,e){var i;let r,n=e.get(t);if(n)return n;if(e.set(t,ju("Recursive definition",t)),Ln(t)){let o=(i=t.element)==null?void 0:i.ref;o&&(Bu(o)?r=Db(o,e):At(o)&&(r=ej(o,e))),r||(t.previous?r=ds(t.previous,e):t.prior&&(r=ds(t.prior,e)))}else if(Yt(t))r=Cb(t,e);else if(Cn(t))r=rj(t,e);else if(At(t)){let o=t.typeName;Vu(o)&&(r=Xp(o,e))}else Bu(t)?r=Db(t,e):cs(t)?r=Rb(t):Uu(t)?r=Nb(t):ei(t)?r=Ib(t):Dp(t)&&(r=tj(t,e));return r||(r=ju("Could not infer type for "+t.$type,t)),e.set(t,r),r}function Db(t,e){let r=t.typeName;return Xp(r,e)}function ej(t,e){return Xp(t.typeName,e)}function tj(t,e){return Xp(t.refName,e)}function Xp(t,e){if(Vu(t)){let r=t.Identifier;if(r){let i=r.ref;if(i)return ds(i,e)}let n=g_(t);if(n)return Ab(n)}}function rj(t,e){let r=t.prior;return r?Yt(r)?Cb(r,e):ds(r,e):ju("Could not infer type for this expression",t)}function Cb(t,e){let r=t.variable.ref;return r?ds(r,e):ju("Could not infer type for this reference",t)}var Jp=class extends rs{constructor(e){super(e)}getScope(e){var r;if(e.property==="element"){let n=e.container,i=(r=n.previous)!=null?r:n.prior;if(!i)return super.getScope(e);let o=ds(i,new Map);if(xb(o))return this.scopeStructMembers(o.literal);if(Eb(o))return this.scopeGlobalVarListMembers(o.literal);if(Ob(o))return this.scopeFunctionBlockMembers(o.literal);if(Sb(o)){let s=this.scopeCache(o.literal);if(s)return s}}else if(e.property==="variable"){let n=this.scopeEnumMembersForExpectedParam(e);return n||super.getScope(e)}return super.getScope(e)}scopeEnumMembersForExpectedParam(e){var l;let r=e.container;if(!Yt(r))return;let n=this.getExpectedEnumTypeForVariable(r);if(!n)return;let i=Ni(n);if(!i)return;let[o]=i,s=(l=o==null?void 0:o.enumChild.map(u=>u.enumVarName))!=null?l:[];if(s.length===0)return;let a=pe(s).map(u=>this.descriptions.createDescription(r,u)).nonNullable();return this.createScope(a,super.getScope(e))}getExpectedEnumTypeForVariable(e){let r=e.$container,n=r==null?void 0:r.$container,i=n==null?void 0:n.$container,o=i==null?void 0:i.$container;if(!wC(n)||!bp(i))return;let s=n.ParamName;if(!s)return;let a=this.getInvokedTypeName(o);if(!a)return;let l=Ge(a),[u]=l!=null?l:[],c=u==null?void 0:u.varDecls.find(f=>f.varName===s);return c==null?void 0:c.varType}getInvokedTypeName(e){if(Cp(e)&&e.assignPrefix){let r=e.assignPrefix.varEnchanceDecl.ref;return At(r)?$t(r.typeName,""):e.assignPrefix.varEnchanceDecl.$refText}if(fo(e)&&e.refFunctionName.refFunctionName){let r=e.refFunctionName.refFunctionName.ref;return At(r)?$t(r.typeName,""):e.refFunctionName.refFunctionName.$refText}}scopeCache(e){let r=Ge(e),n;if(r){let[i,o]=r;if(i){let s=i.varDecls,a=pe(s).map(u=>this.descriptions.createDescription(u,u.varName,o)).nonNullable(),l={caseInsensitive:!1};n=this.createScope(a,n,l)}}if(n)return n}getGlobalScope(e,r){return super.getGlobalScope(e,r)}scopeStructMembers(e){let r=this.getStructChain(e).flatMap(a=>a.items),n=pe(r).map(a=>this.descriptions.createDescription(a,a.variables)).nonNullable(),i=pe(r).map(a=>{let l=a.nextVariables;if(l.length>0)for(let u=0;u<l.length;u++){let c=l[u];return this.descriptions.createDescription(a,c)}}).nonNullable(),o=new $r(n),s=new $r(i);return o}scopeGlobalVarListMembers(e){let r=e.items,n=pe(r).map(o=>this.descriptions.createDescription(o,o.variables)).nonNullable(),i=pe(r).flatMap(o=>pe(o.nextVariables).map(s=>this.descriptions.createDescription(o,s))).nonNullable();return new $r(n.concat(i))}scopeFirstFunctionBlockMembers(e){let r=this.getFunctionBlockDecl(e),n=pe(r).map(i=>{let o=this.nameProvider.getName(i);return o?this.descriptions.createDescription(i,o):this.descriptions.createDescription(i,i.variables)}).nonNullable();return new $r(n)}scopeNextFunctionBlockMembers(e){let r=this.singleVarScope(e,"input"),n=this.singleVarScope(e,"output"),i=this.singleVarScope(e,"local");return new $r(r.getAllElements().concat(n.getAllElements()).concat(i.getAllElements()))}singleVarScope(e,r){let n;r==="input"?n=this.getFunctionBlockChain(e).flatMap(a=>a.varInputs):r==="output"?n=this.getFunctionBlockChain(e).flatMap(a=>a.varOutputs):r==="local"&&(n=this.getFunctionBlockChain(e).flatMap(a=>a.varLocals));let o=this.getFunctionBlockDecl(e).filter(a=>a.nextVariables.length>0),s=pe();for(let a=0;a<o.length;a++){let l=o[a],u=l.nextVariables,c=this.handleNextVariables(l,u),f=this.createScopeForNodes(n,c);s=s.concat(f.getAllElements())}return new $r(s)}scopeFunctionBlockMembers(e){let r=this.scopeFirstFunctionBlockMembers(e),n=this.scopeNextFunctionBlockMembers(e);return new $r(r.getAllElements().concat(n.getAllElements()))}handleNextVariables(e,r){let n=pe(r).map(o=>this.descriptions.createDescription(e,o)).nonNullable();return new $r(n)}getStructDecl(e){let r=[],n=[];return e.items}getFunctionBlockDecl(e){let r=[],n=e.varInputs,i=e.varOutputs,o=e.varLocals;return this.addDecl(n,r),this.addDecl(i,r),this.addDecl(o,r),r}addDecl(e,r){e.forEach(n=>{let i=n.items;r.push(...i)})}getStructChain(e){let r=new Set;return r.add(e),e.items.forEach(i=>{let o=i.typeName;if(Vu(o)){let s=o.Identifier;if(s){let a=s.ref;a&&this.getStructChain(a)}}}),Array.from(r)}getFunctionBlockChain(e){let r=new Set;return r.add(e),Array.from(r)}};function bb(t){let e=t.validation.DocumentValidator,r=t.validation.ValidationRegistry,n=t.validation.StValidator,i={St:n.checkElement};r.register(i,n)}var Qp=class{constructor(e){this.services=e}checkElement(e,r){let n=e.program,i=e.st_function,o=e.function_block,s=e.globalVarLists,a=e.types_struct,l=e.types_alias,u=e.types_enum,c=e.types_union;n.forEach(f=>{this.saveProgramVarInfo(f.inputs,r)}),this.checkPrograms(e,r),this.checkFunctions(i,r),this.checkFunctionBlocks(o,r),this.checkGlobalVarLists(s,r),this.checkProgramExternalDeclarations(e,r),this.checkFunctionBlockExternalDeclarations(e,r),this.checkDateTypes(a,l,u,c,r)}checkPrograms(e,r){this.judgeWhetherHasDuplicateName("program",e.program,r),this.judgeCapital("program",e.program,r),this.checkProgramVarRef(e,r)}checkFunctions(e,r){this.judgeWhetherHasDuplicateName("function",e,r),this.handleFunctionOrBlockInfo(e,r)}checkFunctionBlocks(e,r){this.judgeWhetherHasDuplicateName("functionBlock",e,r),this.judgeCapital("functionBlock",e,r),this.handleFunctionOrBlockInfo(e,r)}checkDateTypes(e,r,n,i,o){this.handleDataTypeVarInfo(e,r,n,i,o)}judgeCapital(e,r,n){r&&r.forEach(i=>{if(i.name){let o=i.name.substring(0,1);/^[a-zA-Z]/.test(o)&&o.toUpperCase()!==o&&n("warning",`${e} name should start with a capital letter`,{node:i,property:"name"})}})}judgeWhetherHasDuplicateName(e,r,n){let i=[];if(r){let o={};r.forEach(a=>{let l=[];OC(a)?(l.push(a.variables),a.nextVariables&&l.push(...a.nextVariables)):l.push(a.name),l.forEach(u=>{o[u]?(o[u]++,i.push(a)):o[u]=1})});let s=Object.keys(o).filter(a=>o[a]>1);i.forEach(a=>{s.length>0&&n("error",`\u91CD\u590D\u5B9A\u4E49\u7684${e}:${s[0]}`,{node:a,property:"name"})})}}checkProgramVarRef(e,r){e.program.forEach(i=>{let o=i.stStatements;if(o){let s=o.statements;this.handleStatements(s,r)}})}handleStatements(e,r){e.length!==0&&e.forEach(n=>{let i=n.$type;if(i==="Selection_statement"){let o=n,s=o.if,a=o.case;if(s){let l=s.ifStatement,u=s.ifCondition,c=s.elsifConditions;this.checkIfWhitespace(s,r),this.checkWhitespace(s,r);let f=s.elsifStatements,d=s.elseStatement;if(u){let m=u.$type;this.handleCondition(m,u,r)}if(c.forEach(m=>{let _=m.$type;this.handleCondition(_,m,r)}),l){let m=l.statements;this.handleStatements(m,r)}if(f){let m=f.statements;this.handleStatements(m,r)}if(d){let m=d.statements;this.handleStatements(m,r)}}if(a){let l=a.caseExpression,u=a.elseStatements,c=a.caseElements,f="";if(Yt(l)){let d=l.variable;f=this.judgeRefNodeType(d.ref,f)}else if(Tn(l))f=this.validateEnumeratedValue(l,void 0,r);else if(Cn(l)){let d=l.prior;Yt(d)?f=this.judgeRefNodeType(d.variable.ref,f):Tn(d)&&(f=this.validateEnumeratedValue(d,void 0,r))}if(u){let d=u.statements;this.handleStatements(d,r)}c.forEach(d=>{let _=d.caseList.caseListElement,x=d.statements;x&&this.handleStatements(this.normalizeStatements(x),r),_.length>0&&_.forEach(A=>{let I=A.numCaseStart,y=A.numericCaseEnd,g=A.enumCase,O=A.simpleEnumCase;if(I&&y&&typeof I=="string"&&typeof y=="string"&&(I=parseInt(I),y=parseInt(y),I>y&&r("error","\u5DE6\u4FA7\u503C\u4E0D\u80FD\u5927\u4E8E\u53F3\u4FA7\u503C!",{node:A,property:"numCaseStart"})),g&&Tn(g)&&this.validateEnumeratedValue(g,f,r),O&&f){let M=this.getEnumMembers(f,A);M&&(M.some(ce=>ce.toLowerCase()===O.toLowerCase())||r("error",`'${O}' is not a member of enum '${f}'.`,{node:A,property:"simpleEnumCase"}))}})})}}else if(i==="Iteration_statement"){let s=n.statement;if(s!=="EXIT"){let a=s.statementList;if(a){let l=a.statements;if(this.handleStatements(l,r),DC(s)){let u=s.controlVariable.ref,c="";At(u)&&(c=this.judgeRefNodeType(u,c));let f=s.forList,m=f.forExpr.prior,_=f.byExpr,x=_==null?void 0:_.prior,A=f.toExpr,I=A==null?void 0:A.prior;this.handleExpressionPrior(m,c,r,m),this.handleExpressionPrior(x,c,r,x),this.handleExpressionPrior(I,c,r,I)}else if(PC(s)){let u=s.untilExpr;this.handleSingleVariableExpression(u,r)}else if(WC(s)){let u=s.whileExpr;this.handleSingleVariableExpression(u,r)}}}}else i==="Function_invoke_or_assign_statement"&&this.handleFunctionInvokeOrAssign(n,r)})}normalizeStatements(e){return!e||e.statements===void 0?[]:Array.isArray(e.statements)?e.statements:[e.statements]}handleCondition(e,r,n){if(e==="Expression"){let i=r.left,o=r.right;this.handleConditionExpression(i,o,n)}else if(e!=="Constant"){if(e!=="FunctionExpression")if(e==="VariableExpression"){let o=r.variable}else e==="Function_invoke_or_assign_statement"&&this.handleFunctionInvokeOrAssign(r,n)}}handleFunctionInvokeOrAssign(e,r){let i=e.statement;if(!MC(i)){let o=i.id,s=i.assign,a=i.params,l=i.assignPrefix;this.handleVariableHint(o,r,!1,s,a,l)}}handleVariableHint(e,r,n,i,o,s){let a="",l,u;if(e){if(fo(e))this.handleFunctionExpression(e,r,e,a);else if(Ln(e)){let c=e;l=c;let f=c.element,d=c.previous;if(f){let m=f.ref,_=f.$refText;m&&(a=this.handleRef(m,_,a,d))}}else if(Cn(e)){let c=e,f=c.prior;if(Yt(f)){let m=f.variable.ref;l=f,a=this.judgeRefNodeType(m,a)}else if(fo(f)){let d=this.handleFunctionExpression(f,r,c,a)}}}if(s){l=s;let c=s.varEnchanceDecl,f=c.ref;u=f;let d=c.$refText;f?(a=this.handleRef(f,d,a),this.handleParam(o,a,r,s)):(a=d,this.handleParam(o,a,r))}if(i){let c=i.expression,f=c==null?void 0:c.$type;if(f==="Constant"){let m=c.constant;this.handleDataTypeMatch(m,a,r,l)}else if(f==="EnumeratedValue"){let d=c;this.validateEnumeratedValue(d,a,r)}else if(f==="Expression"){let d=c,m=d==null?void 0:d.prior,_=d.left,x=d.right;if(m&&this.handleExpressionPrior(m,a,r,l),_&&x){let A=_.prior,I=x.prior;this.handleExpressionPrior(A,a,r,l),this.handleExpressionPrior(I,a,r,l)}}else if(f==="MemberCall"){let d=c,m=d.element,_=d.arguments;if(m){let x=m.ref;if(x&&LC(x)){let A=x,I=A.variable_type,y=A.reqParams,g=[];if(this.handleFunctionBlockMethodReqparam(y,r,g),_.length!==y.length)r("error",`\u671F\u671B${y.length}\u4E2A\u53C2\u6570,\u4F46\u662F\u5B9E\u9645${_.length}\u4E2A`,{node:d,property:"arguments"});else for(let M=0;M<_.length;M++){let J=_[M],ce=g[M],_e=J.prior;this.handlePrior(_e,"","",ce,r)}let O;if(O=kn(I,O,r),O&&a!==""){let[M,J]=this.getComparableTypes(O,a);M&&J&&M.toLowerCase()!==J.toLowerCase()&&r("error",`\u4E0D\u80FD\u5C06\u7C7B\u578B'${O}'\u8F6C\u5316\u4E3A\u7C7B\u578B'${a}'`,{node:d,property:"element"})}}}}}if(o&&o.length>0&&u&&bn(u)){let c=[];this.validateStFunctionRule(u,l,a,r,c,o[0])}}handleParam(e,r,n,i){let o,s;if(i&&(s=i.varEnchanceDecl,o=s.ref),e&&e.length>0){let a=e[0].parameters;if(r){let l=Ge(r);if(l)this.validateLibraryFunction(l,a,n);else if(At(o)){let u=o.typeName;if(u){let c=u.Identifier;if(c){let f=c.ref;if(ei(f)){let d={$type:"FunctionBlockElement",elementType:"functionBlock",elementName:f.name,varDecls:[],rootName:"",comment:"",usage:""};f.varInputs.forEach(m=>{m.items.forEach(x=>{let I={$type:"VarDeclaration",varName:x.variables,varType:$t(x.typeName,""),varGlobalType:"VAR_INPUT"};d.varDecls.push(I)})}),f.varOutputs.forEach(m=>{m.items.forEach(x=>{let I={$type:"VarDeclaration",varName:x.variables,varType:$t(x.typeName,""),varGlobalType:"VAR_OUTPUT"};d.varDecls.push(I)})}),this.validateLibraryFunction(d,a,n,!0)}else cs(f)&&i&&n("error","\u65E0\u6CD5\u8C03\u7528\u7C7B\u578B'TYPE'\u7684\u5BF9\u8C61",{node:i,property:"varEnchanceDecl"})}else i&&n("error",`\u9700\u8981\u7A0B\u5E8F\u540D,\u51FD\u6570\u6216\u529F\u80FD\u5757\u5B9E\u4F8B\u66FF\u4EE3${i==null?void 0:i.varEnchanceDecl.$refText}`,{node:i,property:"varEnchanceDecl"})}}}}}handleRef(e,r,n,i){if(cs(e.$container)){let a=e.$container.items.find(l=>l.variables===r);if(a){let l=a.typeName;n=this.judgeType(n,l)}}else if(At(e)){let s=e.typeName;n=this.judgeType(n,s)}else if(i){let o=i.prior;if(Yt(o)){let s=o.variable.ref;if(At(s)){let a=s.typeName;if(a.Cache_type_name){let l=a.Cache_type_name,u=Ge(l);if(u){let[c,f]=u;if(c){let d=c.varDecls.find(m=>m.varName===r);n=d==null?void 0:d.varType}}}}}}return n}judgeRefNodeType(e,r){if(At(e)){let n=e.typeName;r=$t(n,r)}return r}judgeType(e,r){return e=$t(r,e),e}getCurrentRoot(e){if(e)return e.$type==="St"?e:Qt.getContainerOfType(e,r=>r.$type==="St")}checkGlobalVarLists(e,r){e.forEach(n=>{this.judgeWhetherHasDuplicateName("global variable",n.items,r),n.items.forEach(i=>{this.validateDeclarationVar(i,r)})})}checkProgramExternalDeclarations(e,r){e.program.forEach(n=>{this.getProgramExternalDeclarations(n).forEach(o=>this.validateExternalDeclaration(o,e,r))})}checkFunctionBlockExternalDeclarations(e,r){e.function_block.forEach(n=>{n.varExternals.forEach(i=>{i.items.forEach(o=>this.validateExternalDeclaration(o,e,r))})})}getProgramExternalDeclarations(e){let r=[],n=new Set;return e.inputs.filter(i=>i.definition==="VAR_EXTERNAL").forEach(i=>{i.items.forEach(o=>{n.has(o)||(n.add(o),r.push(o))})}),e.varExternals.forEach(i=>{i.items.forEach(o=>{n.has(o)||(n.add(o),r.push(o))})}),r}validateExternalDeclaration(e,r,n){[e.variables,...e.nextVariables].forEach((o,s)=>{let a=this.findGlobalVariableMatches(o,r),l=s===0?"variables":"nextVariables",u=s===0?void 0:s-1;if(a.length===0){n("error",`VAR_EXTERNAL \u58F0\u660E\u7684\u5168\u5C40\u53D8\u91CF '${o}' \u4E0D\u5B58\u5728`,{node:e,property:l,index:u});return}let c=a.filter(A=>!this.hasQualifiedOnly(A.list));if(c.length===0){n("error",`\u5168\u5C40\u53D8\u91CF '${o}' \u6240\u5728\u5168\u5C40\u53D8\u91CF\u5217\u8868\u542F\u7528\u4E86 qualified_only\uFF0C\u4E0D\u80FD\u901A\u8FC7 VAR_EXTERNAL \u5F15\u7528`,{node:e,property:l,index:u});return}let f=c[0].declaration,d="",m="";d=$t(e.typeName,d),m=$t(f.typeName,m);let[_,x]=this.getComparableTypes(m,d);_&&x&&_.toLowerCase()!==x.toLowerCase()&&n("error",`VAR_EXTERNAL '${o}' \u7684\u7C7B\u578B'${d}'\u4E0E\u5168\u5C40\u53D8\u91CF\u7C7B\u578B'${m}'\u4E0D\u4E00\u81F4`,{node:e,property:"typeName"})})}findGlobalVariableMatches(e,r){let n=e.toLowerCase(),i=[];return this.getAllGlobalVarLists(r).forEach(o=>{o.items.forEach(s=>{[s.variables,...s.nextVariables].some(l=>l.toLowerCase()===n)&&i.push({list:o,declaration:s})})}),i}getAllGlobalVarLists(e){let r=new Map;e.globalVarLists.forEach(n=>{r.set(this.getGlobalVarListKey(n),n)});for(let n of this.services.shared.workspace.IndexManager.allElements("GlobalVarList")){let i=n.node;i&&i.$type==="GlobalVarList"&&r.set(this.getGlobalVarListKey(i),i)}return Array.from(r.values())}getGlobalVarListKey(e){let r=Qt.getDocument(e),n=this.services.workspace.AstNodeLocator.getAstNodePath(e);return`${r.uri.toString()}#${n}`}hasQualifiedOnly(e){return e.attributes.some(r=>this.normalizeAttributeName(r.attributeName)==="qualified_only")}normalizeAttributeName(e){return e.trim().replace(/^['"]|['"]$/g,"").toLowerCase()}getGlobalVarListDisplayName(e){var r;return(r=this.services.references.NameProvider.getName(e))!=null?r:"GVL"}getLocalEnumByName(e,r){if(!e)return;let n=this.getCurrentRoot(r);return n==null?void 0:n.types_enum.find(i=>i.name.toLowerCase()===e.toLowerCase())}getLinkedEnumByName(e,r){var i;if(!e||!r||!Tn(r))return;let n=(i=r.enumType)==null?void 0:i.ref;if((n==null?void 0:n.$type)==="StEnum"&&n.name.toLowerCase()===e.toLowerCase())return n}getWorkspaceEnumByName(e){if(!e)return;let r=this.services.shared.workspace.IndexManager,n=this.services.shared.workspace.LangiumDocuments,i=this.services.workspace.AstNodeLocator;for(let o of r.allElements("StEnum"))if(o.name.toLowerCase()===e.toLowerCase()){let s=n.getDocument(o.documentUri);if(s){let a=i.getAstNode(s.parseResult.value,o.path);if(a)return a}}}getEnumMembers(e,r){if(!e)return;let n=this.getLocalEnumByName(e,r);if(n)return n.enum.map(a=>a.variable_name);let i=this.getLinkedEnumByName(e,r);if(i)return i.enum.map(a=>a.variable_name);let o=this.getWorkspaceEnumByName(e);if(o)return o.enum.map(a=>a.variable_name);let s=Ni(e);if(s){let[a]=s;return a==null?void 0:a.enumChild.map(l=>l.enumVarName)}}getEnumeratedValueTypeName(e){var n,i;if(e.enumCacheTypeName)return e.enumCacheTypeName;let r=(n=e.enumType)==null?void 0:n.ref;if(r){if(r.$type==="StEnum")return r.name;if("elementType"in r&&r.elementType==="enum"&&"elementName"in r){let o=r.elementName;if(typeof o=="string")return o}}return(i=e.enumType)==null?void 0:i.$refText}validateEnumeratedValue(e,r,n){let i=this.getEnumeratedValueTypeName(e),o=this.getEnumMembers(i,e);if(i&&o&&(o.some(a=>a.toLowerCase()===e.enumValue.toLowerCase())||n("error",`'${e.enumValue}' is not a member of enum '${i}'.`,{node:e,property:"enumValue"})),i&&r){let[s,a]=this.getComparableTypes(i,r);s&&a&&s.toLowerCase()!==a.toLowerCase()&&n("error",`Cannot convert enum type '${i}' to type '${r}'.`,{node:e,property:"enumValue"})}return i}handleExpressionPrior(e,r,n,i){if(e){i||(i=e);let o=e==null?void 0:e.$type;if(o==="Constant"){let a=e.constant;this.handleDataTypeMatch(a,r,n,i)}else if(o==="EnumeratedValue"){let s=e;this.validateEnumeratedValue(s,r,n)}else if(o==="FunctionExpression"){let s=this.handleFunctionExpression(e,n,i,r)}else if(o==="VariableExpression"){let s=e,a=s.variable.ref,l="";if(l=this.judgeRefNodeType(a,l),l&&r){let[u,c]=this.getComparableTypes(l,r);u&&c&&u.toLowerCase()!==c.toLowerCase()&&n("error",`\u4E0D\u80FD\u5C06\u7C7B\u578B'${l}'\u8F6C\u5316\u4E3A\u7C7B\u578B'${r}'`,{node:s,property:"variable"})}}}}handleFunctionExpression(e,r,n,i){let o=e,s=o.refFunctionName,a=o.params;if(s.refFunctionName){let l=s.refFunctionName.ref,u=o.params,c=[];if(l)if(bn(l))this.validateStFunctionRule(l,n,i,r,c,u);else if(At(l)){if(i=this.judgeRefNodeType(l,i),i){let f=Ge(i);if(f&&u){let d=u.parameters;this.validateLibraryFunction(f,d,r)}}}else this.isLibraryCallableElement(l)&&u&&this.validateLibraryFunction([l],u.parameters,r);else if(u){let f=Ge(s.refFunctionName.$refText);f&&this.validateLibraryFunction(f,u.parameters,r)}}else if(s.Cache_type_name){let l=s.Cache_type_name,u=this.getCacheFunctionReturnType(l);if(this.validateReturnTypeCompatibility(u,i,r,o,"refFunctionName"),a){let c=a.parameters,f=Ge(l);f&&this.validateLibraryFunction(f,c,r)}}}validateStFunctionRule(e,r,n,i,o,s){let a=e.variable_type,l=e.varInputs,u,c=[];if(l.forEach(f=>{f.items.forEach(m=>{let _=m.nextVariables;_.length>0&&_.forEach(x=>{c.push(x)})}),c.push(...f.items)}),a&&(u=$t(a,u),r&&u&&n)){let[f,d]=this.getComparableTypes(u,n);f&&d&&f.toLowerCase()!==d.toLowerCase()&&i("error",`\u4E0D\u80FD\u5C06\u7C7B\u578B'${u}'\u8F6C\u5316\u4E3A\u7C7B\u578B'${n}'`,{node:r,property:Ja(r)?"varEnchanceDecl":"prior"})}if(this.handleFunctionReqparam(c,i,o),s){let f=s.parameters;if(c.length!==f.length)i("error",`\u671F\u671B${c.length}\u4E2A\u8F93\u5165,\u4F46\u662F\u5B9E\u9645${f.length}\u4E2A`,{node:s,property:"parameters"});else for(let d=0;d<f.length;d++){let m=f[d],_=o[d],x=m.ParamValue;if(x){let A=x.prior;this.handlePrior(A,"","",_,i)}}}}validateLibraryFunction(e,r,n,i){if(i)this.validateFb(e,r,n,i);else{let[o,s]=e;if(o){let a=o.elementType;a==="functionBlock"?(o=o,this.validateFb(o,r,n)):a==="function"&&(o=o,this.validateFb(o,r,n,!1,!0))}}}isLibraryCallableElement(e){let r=e.elementType;return r==="functionBlock"||r==="function"}validateFb(e,r,n,i,o){let s=this.judgeCacheNodeInputOutputVarDecl(":=",e),a=this.judgeCacheNodeInputOutputVarDecl("=>",e);r.forEach(l=>{let u=l.ParamName,c=l.ParamValue,f=l.InputOrOutputSign,d=!1,m=i?e==null?void 0:e.elementName:e==null?void 0:e.elementName.toUpperCase();f===":="&&u&&(s.has(u)||(d=!0,n("error",`${u}\u4E0D\u662F${m}\u7684\u8F93\u5165\u53C2\u6570`,{node:l,property:"ParamName"}))),f==="=>"&&u&&(a.has(u)||(d=!0,n("error",`${u}\u4E0D\u662F${m}\u7684\u8F93\u51FA\u53C2\u6570`,{node:l,property:"ParamName"}))),d||c&&!o&&this.handleCacheTypeMatch(u,c,e,n,l)})}normalizeTypeAlias(e,r=new Set){var o;if(!e)return;let n=e.toUpperCase();if(n==="DT")return"DATE_AND_TIME";if(n==="TOD")return"TIME_OF_DAY";let i=Ge(e);if(i){let[s]=i;if((s==null?void 0:s.elementType)==="alias"){let a=s,l=a.elementName.toUpperCase();return r.has(l)?l:(r.add(l),(o=this.normalizeTypeAlias(a.refName,r))!=null?o:n)}}return n}getComparableTypes(e,r){return[this.normalizeTypeAlias(e),this.normalizeTypeAlias(r)]}getCacheFunctionReturnType(e){let r=Ge(e);if(!r)return;let[n]=r;if(!n||n.elementType!=="function")return;let i=n.varDecls.find(s=>s.varGlobalType==="VAR_OUTPUT"&&s.varName.toUpperCase()==="OUT")||n.varDecls.find(s=>s.varGlobalType==="VAR_OUTPUT"),o=this.normalizeTypeAlias(i==null?void 0:i.varType);if(!(!o||o==="ANY"||o.startsWith("ANY_")))return o}validateReturnTypeCompatibility(e,r,n,i,o){let s=this.normalizeTypeAlias(e),a=this.normalizeTypeAlias(r);s&&a&&s.toLowerCase()!==a.toLowerCase()&&n("error",`\u4E0D\u80FD\u5C06\u7C7B\u578B'${s}'\u8F6C\u5316\u4E3A\u7C7B\u578B'${a}'`,{node:i,property:o})}judgeCacheNodeInputOutputVarDecl(e,r){let n=new Set;if(!e)return n;let i="",o=r==null?void 0:r.varDecls;return e===":="?i="VAR_INPUT":e==="=>"&&(i="VAR_OUTPUT"),o&&(o==null||o.forEach(s=>{s.varGlobalType===i&&n.add(s.varName)})),n}handleCacheTypeMatch(e,r,n,i,o){var l;if(!n)return;let s=n.varDecls.find(u=>u.varName===e),a=s==null?void 0:s.varType;if(Qa(r.prior)){let c=r.prior.constant;this.handleDataTypeMatch(c,a,i,r)}else if(Yt(r.prior)){let u=r.prior,c=u.variable.ref,f="";if(f=this.judgeRefNodeType(c,f),f&&a){let[d,m]=this.getComparableTypes(f,a);d&&m&&d.toLowerCase()!==m.toLowerCase()&&i("error",`\u4E0D\u80FD\u5C06\u7C7B\u578B'${f}'\u8F6C\u5316\u4E3A\u7C7B\u578B'${a}'`,{node:u,property:"variable"})}}else if(Tn(r.prior)){let u=r.prior;this.validateEnumeratedValue(u,a,i)}else if(Ln(r)){let u=r.element,c=(l=r.previous)==null?void 0:l.prior,f="",d="";if(Yt(c)){let _=c.variable.ref;if(At(_)&&(f=_.variables,d=this.judgeRefNodeType(_,d)),d){let x=Ge(d.toUpperCase());if(x&&u){let[A,I]=x;if(A){let y=A.varDecls.find(g=>g.varName===(u==null?void 0:u.$refText));if(y){let g=y.varType;if(g&&a){let[O,M]=this.getComparableTypes(g,a);O&&M&&O.toLowerCase()!==M.toLowerCase()&&i("error",`\u4E0D\u80FD\u5C06\u7C7B\u578B'${g}'\u8F6C\u5316\u4E3A\u7C7B\u578B'${a}'`,{node:o,property:"ParamName"})}}}}}}}else if(fo(r.prior)){let u=r.prior;if(u.refFunctionName.refFunctionName){let c=u.refFunctionName.refFunctionName.ref;if(c){if(bn(c)){let f=c.variable_type,d;d=kn(f,d,i),this.validateReturnTypeCompatibility(d,a,i,u,"refFunctionName")}}else{let f=u.refFunctionName.refFunctionName.$refText}}else if(u.refFunctionName.Cache_type_name){let c=u.refFunctionName.Cache_type_name,f=this.getCacheFunctionReturnType(c);this.validateReturnTypeCompatibility(f,a,i,u,"refFunctionName")}}}handleFunctionReqparam(e,r,n){e.forEach(i=>{let o=i.typeName,s=i.nextVariables,a;if(o&&(a=kn(o,a,r),n&&(n.push(a),s.length>0)))for(let l=0;l<s.length;l++)n.push(a)})}handleFunctionBlockMethodReqparam(e,r,n){e.forEach(i=>{let o=i.typeName,s;o&&(s=kn(o,s,r),n&&n.push(s))})}handleDataTypeMatch(e,r,n,i){if(!i)return;r=this.normalizeTypeAlias(r);let o=[];if(Xa(e)){let s=e.arrElements;for(let a=0;a<s.length;a++){let l=s[a];o=mo(l.constant),e=this.handleDataTypeMatchHint(o,r,i,n,e)}}else o=mo(e),e=this.handleDataTypeMatchHint(o,r,i,n,e);return e}handleDataTypeMatchHint(e,r,n,i,o){if(r=this.normalizeTypeAlias(r),e.length===1){if(r&&e&&(r==null?void 0:r.toLowerCase())!==e[0].toLowerCase()){let s=fs(e[0],r,o),[a,l]=this.checkTimeType(r);if(a&&e[0].toLowerCase()==="string"){let u=c_(o.toString(),l);Ln(n)?u!==""&&i("error",u,{node:n,property:"element"}):Yt(n)?u!==""&&i("error",u,{node:n,property:"variable"}):Cn(n)&&u!==""&&i("error",u,{node:n,property:"prior"})}a||s&&(Ln(n)?i("error",`\u4E0D\u80FD\u5C06\u7C7B\u578B'${e[0]}'\u8F6C\u5316\u4E3A\u7C7B\u578B'${r}'`,{node:n,property:"element"}):Yt(n)?i("error",`\u4E0D\u80FD\u5C06\u7C7B\u578B'${e[0]}'\u8F6C\u5316\u4E3A\u7C7B\u578B'${r}'`,{node:n,property:"variable"}):Cn(n)&&i("error",`\u4E0D\u80FD\u5C06\u7C7B\u578B'${e[0]}'\u8F6C\u5316\u4E3A\u7C7B\u578B'${r}'`,{node:n,property:"prior"})),!a&&s&&Ja(n)&&i("error",`\u4E0D\u80FD\u5C06\u7C7B\u578B'${e[0]}'\u8F6C\u5316\u4E3A\u7C7B\u578B'${r}'`,{node:n,property:"varEnchanceDecl"})}}else{o=o;let[s,a]=this.convertValue(o,r);s!==""&&s!=="\u53D8\u91CF\u7C7B\u578B\u4E3Aundefined!"&&(Ln(n)?i(a,s,{node:n,property:"element"}):Yt(n)?i(a,s,{node:n,property:"variable"}):Cn(n)?i(a,s,{node:n,property:"prior"}):Ja(n)&&i(a,s,{node:n,property:"varEnchanceDecl"}))}return o}handleSingleVariableExpression(e,r){if(e){let n=e,i=n.left,o=n.right;this.handleConditionExpression(i,o,r)}}handleConditionExpression(e,r,n){if(e&&r){let i=e.$type,o=r.$type;if(i==="Expression"){let s="",a="",u=e.prior,c=u==null?void 0:u.$type;if(Yt(u)){let d=u.variable.ref;At(d)&&(a=d.variables,s=this.judgeRefNodeType(d,s))}else Tn(u)&&(s=this.validateEnumeratedValue(u,void 0,n));if(o==="Expression"){let d=r.prior;this.handlePrior(d,"","",s,n)}}}}handlePrior(e,r,n,i,o){if(Yt(e)){let a=e.variable.ref;if(At(a)&&(r=a.variables,n=this.judgeRefNodeType(a,n)),i&&n){let[l,u]=this.getComparableTypes(n,i);u&&l&&u.toLowerCase()!==l.toLowerCase()&&(u.toLowerCase()==="string"&&o("error",`\u4E0D\u80FD\u5C06\u7C7B\u578B'${n}'\u8F6C\u5316\u4E3A\u7C7B\u578B'${i}'`,{node:e,property:"variable"}),fs(l,u)&&o("error",`\u4E0D\u80FD\u5C06\u7C7B\u578B'${n}'\u8F6C\u5316\u4E3A\u7C7B\u578B'${i}'`,{node:e,property:"variable"}))}}else if(Tn(e))n=this.validateEnumeratedValue(e,i,o);else if(Qa(e)){let s=e,a=s.constant,l=[];if(Xa(a)){let u=a.arrElements;for(let c=0;c<u.length;c++){let f=u[c];l=mo(f.constant),a=this.handleConditionExpressionHint(l,i,o,s)}}else l=mo(a),a=this.handleConditionExpressionHint(l,i,o,s)}return{rightVariableName:r,rightExpectType:n}}handleConditionExpressionHint(e,r,n,i){r=this.normalizeTypeAlias(r);let o=i.constant;if(e.length===1)r&&e&&(r==null?void 0:r.toLowerCase())!==e[0].toLowerCase()&&fs(e[0],r,o)&&n("error",`\u4E0D\u80FD\u5C06\u7C7B\u578B'${e}'\u8F6C\u5316\u4E3A\u7C7B\u578B'${r}'`,{node:i,property:"constant"});else{o=o,!kp(o.toString())&&!po(o.toString())&&n("error",`${o}\u4E0D\u662F\u4E00\u4E2A\u6574\u6570`,{node:i,property:"constant"});let[a,l]=this.convertValue(o,r);a!==""&&a!=="\u53D8\u91CF\u7C7B\u578B\u4E3Aundefined!"&&n(l,a,{node:i,property:"constant"})}return o}convertValue(e,r){let n=["","error"],i={BOOL:{min:0,max:1},SINT:{min:-128,max:127},BYTE:{min:0,max:255},INT:{min:-32768,max:32767},UINT:{min:0,max:65535},DINT:{min:-2147483648,max:2147483647},UDINT:{min:0,max:4294967295},LINT:{min:-Math.pow(2,63),max:Math.pow(2,63)-1},WORD:{min:0,max:65535},DWORD:{min:0,max:4294967295},LWORD:{min:0,max:Math.pow(2,64)-1}},o;if(r=this.normalizeTypeAlias(r),r===void 0)return["\u53D8\u91CF\u7C7B\u578B\u4E3Aundefined!","error"];if(r===""||Rt(r))return n;if(r.toUpperCase()==="REAL"||r.toUpperCase()==="LREAL"){if(typeof e=="string"&&!T_(e)){let s=parseInt(e,10);o=Object.keys(i).find(a=>s>=i[a].min&&s<=i[a].max&&a!==r),n=o?[`\u5EFA\u8BAE\u5C06\u7C7B\u578B'${o}'\u8F6C\u5316\u4E3A'${r}'\u7C7B\u578B`,"warning"]:["No suitable conversion type found","warning"]}return n}if(i[r]){let{min:s,max:a}=i[r];if(typeof e=="number"){if(!(e>=s&&e<=a)){o=Object.keys(i).find(u=>e>=i[u].min&&e<=i[u].max&&u!==r);let l=fs(o,r,e);o?l&&(n=[`\u4E0D\u80FD\u5C06\u7C7B\u578B'${o}'\u8F6C\u5316\u4E3A'${r}'\u7C7B\u578B`,"error"]):n=["No suitable conversion type found","error"]}return n}else if(po(e))r&&(r.toLowerCase()!=="REAL"||r.toLowerCase()!=="LREAL")&&(n=[`\u4E0D\u80FD\u5C06\u7C7B\u578B'LREAL'\u8F6C\u5316\u4E3A'${r}'\u7C7B\u578B`,"error"]);else{let u=parseInt(e,10);n=this.convertValue(u,r)}}else if(typeof e=="number"){if(o=Object.keys(i).find(s=>e>=i[s].min&&e<=i[s].max&&s!==r),o){if(r){let s=fs(o,r,e);if(r.toUpperCase()==="STRING"){if((o==null?void 0:o.toLowerCase())!==r.toLowerCase())return n=[`\u4E0D\u80FD\u5C06\u7C7B\u578B'${o}'\u8F6C\u5316\u4E3A'${r}'\u7C7B\u578B`,"error"],n}else if(s)return n=[`\u4E0D\u80FD\u5C06\u7C7B\u578B'${o}'\u8F6C\u5316\u4E3A'${r}'\u7C7B\u578B`,"error"],n}}else n=["No suitable conversion type found","error"];return n}else if(typeof e=="string"){if(T_(e)){let a=po(e)?parseFloat(e):parseInt(e,10);n=this.convertValue(a,r)}return n}return n}saveProgramVarInfo(e,r){e.forEach(n=>{let i=n.definition,o=n.items,s=n.modifiers,a="";s?a=i.concat(s):a=i,this.judgeWhetherHasDuplicateName("\u5C40\u90E8\u53D8\u91CF",o,r),o.forEach(l=>{this.validateDeclarationVar(l,r)})})}handleFunctionOrBlockInfo(e,r){e.forEach(n=>{let i=n.varLocals,o=n.varInputs,s=n.varOutputs,a=[],l=[],u=[];if(i.forEach(c=>{a.push(...c.items)}),o.forEach(c=>{l.push(...c.items)}),s.forEach(c=>{u.push(...c.items)}),this.handleEachVarTypeVariable(a,r),this.handleEachVarTypeVariable(l,r),this.handleEachVarTypeVariable(u,r),!ei(n)){if(bn(n)){let c=n.variable_type,f=n.varInputs,d=[];f.forEach(_=>{d.push(_.items)}),this.handleFunctionReqparam(d,r);let m;m=kn(c,m,r)}}})}handleDataTypeVarInfo(e,r,n,i,o){let s=e,a=i,l=n,u=r;s.forEach(c=>{if(c){let f=c.items;this.judgeWhetherHasDuplicateName("\u5C40\u90E8\u53D8\u91CF",f,o),f==null||f.forEach(d=>{this.validateDeclarationVar(d,o);let m=d.typeName,_;m&&(m.$type==="Native_Type_Name"?_=kn(m,_,o):m.$type==="Array_liters"&&(_=m.dataType))})}}),a.forEach(c=>{if(c){let f=c.items;this.judgeWhetherHasDuplicateName("\u5C40\u90E8\u53D8\u91CF",f,o),f==null||f.forEach(d=>{this.validateDeclarationVar(d,o);let m=d.typeName,_;m&&(m.$type==="Native_Type_Name"?_=kn(m,_,o):m.$type==="Array_liters"&&(_=m.dataType))})}}),l.forEach(c=>{let f=c.enum}),u.forEach(c=>{let f="";f=kn(c.refName,f,o);let d=c.initialValue;if(d){let m=mo(d);this.handleVarDeclHint(m,f,o,c,d)}})}handleEachVarTypeVariable(e,r){e&&this.judgeWhetherHasDuplicateName("\u5C40\u90E8\u53D8\u91CF",e,r),e==null||e.forEach(n=>{this.validateDeclarationVar(n,r);let i=n.typeName,o;i&&(i.$type==="Native_Type_Name"?o=kn(i,o,r):i.$type==="Array_liters"&&(o=i.dataType))})}validateDeclarationVar(e,r){let n=e.typeName,i;if(n){if(n.$type==="Native_Type_Name")i=kn(n,i,r);else if(n.$type==="Array_liters"){let a=n,l=a.dataType;i=$t(l,i),a.arrayElemets.forEach(c=>{let f=c.left,d=c.right,m=parseInt(f,10),_=parseInt(d,10);m&&_&&m>_&&r("error","\u6570\u7EC4\u5DE6\u4FA7\u503C\u4E0D\u80FD\u5927\u4E8E\u53F3\u4FA7\u503C!",{node:e,property:"typeName"})})}}let o=e.initialValue,s=[];if(o){let a=o.constant;if(Xa(a)){let l=a.arrElements;for(let u=0;u<l.length;u++){let c=l[u];s=mo(c.constant),this.handleVarDeclHint(s,i,r,e,c.constant)}}else s=mo(o),this.handleVarDeclHint(s,i,r,e,o)}}handleVarDeclHint(e,r,n,i,o){if(typeof r=="string"&&(r=this.normalizeTypeAlias(r)),e.length===1){if(r!==void 0&&!Rt(r)&&r&&e[0]&&r.toLowerCase()!==e[0].toLowerCase()){let s=Qa(o)?o.constant:o,a=fs(e[0],r,s),[l,u]=this.checkTimeType(r);if(l&&e[0].toLowerCase()==="string"){let c=Qa(o)?o.constant.toString():o.toString(),f=c_(c,u);f!==""&&n("error",f,{node:i,property:"initialValue"})}l||a&&n("error",`\u4E0D\u80FD\u5C06\u7C7B\u578B'${e[0]}'\u8F6C\u5316\u4E3A\u7C7B\u578B'${r}'`,{node:i,property:"initialValue"})}}else if(Qa(o)){let s=o.constant;this.handleInnerVarDeclHint(s,r,n,i),!kp(s)&&!po(s)&&n("error",`${s}\u4E0D\u662F\u4E00\u4E2A\u6574\u6570`,{node:o,property:"constant"})}else{let s=o;this.handleInnerVarDeclHint(s,r,n,i),!kp(s)&&!po(s)&&n("error",`${s}\u4E0D\u662F\u4E00\u4E2A\u6574\u6570`,{node:i,property:"initialValue"})}}handleInnerVarDeclHint(e,r,n,i){if(po(e)){let[o,s]=this.convertValue(e,r);o!==""&&o!=="\u53D8\u91CF\u7C7B\u578B\u4E3Aundefined!"&&n(s,o,{node:i,property:"initialValue"})}else{let o=parseInt(e,10),[s,a]=this.convertValue(o,r);s!==""&&s!=="\u53D8\u91CF\u7C7B\u578B\u4E3Aundefined!"&&n(a,s,{node:i,property:"initialValue"})}}checkTimeType(e){let r=["TIME","DATE","DATE_AND_TIME","TIME_OF_DAY"],n=e.toUpperCase();return r.includes(n)?[!0,n]:[!1,"unmatched time type"]}checkIfWhitespace(e,r){if(e){let n=Qt.getDocument(e).parseResult.value.$cstNode.fullText,i=bt.findNodeForKeyword(e.$cstNode,"THEN");if(i){let o=i.offset;n.charAt(o-1)!==" "&&r("warning","THEN\u524D\u9762\u9700\u8981\u6709\u7A7A\u683C",{node:e,property:"ifCondition",index:0})}}}checkWhitespace(e,r){if(e){let n=Qt.getDocument(e).parseResult.value.$cstNode.fullText,i=bt.findNodesForKeyword(e.$cstNode,"THEN");for(let o=0;o<i.length;o++){if(o===0)continue;let a=i[o].offset;n.charAt(a-1)!==" "&&r("warning","THEN\u524D\u9762\u9700\u8981\u6709\u7A7A\u683C",{node:e,property:"elsifConditions",index:o-1})}}}};var Zp=class extends ns{constructor(e){super(e)}serialize(e,r){return super.serialize(e,r)}deserialize(e,r={}){let i=JSON.parse(e),o=xi(i);return hb(o)}};var v_=class extends is{register(e){super.register(e)}getServices(e){return super.getServices(e)}},ype=Symbol("StatemachineSharedServices"),nj={ServiceRegistry:()=>new v_,logger:{ClientLogger:t=>new Gp(t)}},_pe=Symbol("StatemachineServices");function ij(t){return{shared:()=>t.shared,parser:{},validation:{DocumentValidator:e=>new jp(e),StValidator:e=>new Qp(e)},lsp:{Formatter:()=>new zp,CompletionProvider:e=>new Fp(e),SignatureHelp:()=>new Bp,DocumentHighlightProvider:e=>new Up(e)},references:{ScopeProvider:e=>new Jp(e),ScopeComputation:e=>new Kp(e),Linker:e=>new Yp(e),NameProvider:()=>new qp,References:e=>new Vp(e)},workspace:{ReferenceDescriptionProvider:e=>new Hp(e)},serializer:{JsonSerializer:e=>new Zp(e)}}}function Lb(t){let e=ls(RC(t),Tb,nj),r=ls(vC({shared:e}),yb,ij({shared:e}));return e.ServiceRegistry.register(r),bb(r),{shared:e,st:r}}var oj=(0,rl.createConnection)(new rl.IPCMessageReader(process),new rl.IPCMessageWriter(process)),{shared:Wu,st:Lp}=Lb({connection:oj,...NC});TC(Wu);0&&(module.exports={shared,st});
/*! Bundled license information:

reflect-metadata/Reflect.js:
  (*! *****************************************************************************
  Copyright (C) Microsoft. All rights reserved.
  Licensed under the Apache License, Version 2.0 (the "License"); you may not use
  this file except in compliance with the License. You may obtain a copy of the
  License at http://www.apache.org/licenses/LICENSE-2.0
  
  THIS CODE IS PROVIDED ON AN *AS IS* BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
  KIND, EITHER EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION ANY IMPLIED
  WARRANTIES OR CONDITIONS OF TITLE, FITNESS FOR A PARTICULAR PURPOSE,
  MERCHANTABLITY OR NON-INFRINGEMENT.
  
  See the Apache Version 2.0 License for specific language governing permissions
  and limitations under the License.
  ***************************************************************************** *)

lodash-es/lodash.js:
  (**
   * @license
   * Lodash (Custom Build) <https://lodash.com/>
   * Build: `lodash modularize exports="es" -o ./`
   * Copyright OpenJS Foundation and other contributors <https://openjsf.org/>
   * Released under MIT license <https://lodash.com/license>
   * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
   * Copyright Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
   *)
*/
