import{a3 as Je,a4 as Qe,a5 as Ae,T as w,a6 as te,a7 as G,a8 as et,a9 as tt,aa as x,ab as U,ac as M,ad as T,ae as D,af as B,ag as nt,ah as _,ai as Ce,aj as rt,ak as _e,al as it,V as Fe,U as Ie,K as st}from"./BasemapSwitcher-UqSTSycc.js";import{f as Q,aB as v,az as ot,_ as $,X as ge,aa as at,V as lt,Y as Ue,aK as pe,aH as Me,av as ct,bq as ut,bu as ft,ad as ht,F as dt,l as k,aL as _t,bn as gt,bv as pt,u as xt,ab as mt}from"./Polygon-CYCrQap5.js";import{R as Et}from"./GeometryCollection-B1iPtE5W.js";import{b as j}from"./Vector-ZNPzhFXp.js";function ze(){return[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]}function fe(r,e){return r[0]=e[0],r[1]=e[1],r[4]=e[2],r[5]=e[3],r[12]=e[4],r[13]=e[5],r}const q=34962,xe=34963,vt=35044,ne=35048,Tt=5121,yt=5123,Pt=5125,Ge=5126,$e=["experimental-webgl","webgl","webkit-3d","moz-webgl"];function bt(r,e){e=Object.assign({preserveDrawingBuffer:!0,antialias:!Je},e);const t=$e.length;for(let n=0;n<t;++n)try{const s=r.getContext($e[n],e);if(s)return s}catch{}return null}const St={STATIC_DRAW:vt};class re{constructor(e,t){this.array_=null,this.type_=e,Q(e===q||e===xe,"A `WebGLArrayBuffer` must either be of type `ELEMENT_ARRAY_BUFFER` or `ARRAY_BUFFER`"),this.usage_=t!==void 0?t:St.STATIC_DRAW}ofSize(e){return this.array_=new(W(this.type_))(e),this}fromArray(e){return this.array_=W(this.type_).from(e),this}fromArrayBuffer(e){return this.array_=new(W(this.type_))(e),this}getType(){return this.type_}getArray(){return this.array_}setArray(e){const t=W(this.type_);if(!(e instanceof t))throw new Error(`Expected ${t}`);this.array_=e}getUsage(){return this.usage_}getSize(){return this.array_?this.array_.length:0}}function W(r){switch(r){case q:return Float32Array;case xe:return Uint32Array;default:return Float32Array}}const X={LOST:"webglcontextlost",RESTORED:"webglcontextrestored"},Rt=`
  precision mediump float;

  attribute vec2 a_position;
  varying vec2 v_texCoord;
  varying vec2 v_screenCoord;

  uniform vec2 u_screenSize;

  void main() {
    v_texCoord = a_position * 0.5 + 0.5;
    v_screenCoord = v_texCoord * u_screenSize;
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`,At=`
  precision mediump float;

  uniform sampler2D u_image;
  uniform float u_opacity;

  varying vec2 v_texCoord;

  void main() {
    gl_FragColor = texture2D(u_image, v_texCoord) * u_opacity;
  }
`;class Le{constructor(e){this.gl_=e.webGlContext;const t=this.gl_;this.scaleRatio_=e.scaleRatio||1,this.renderTargetTexture_=t.createTexture(),this.renderTargetTextureSize_=null,this.frameBuffer_=t.createFramebuffer(),this.depthBuffer_=t.createRenderbuffer();const n=t.createShader(t.VERTEX_SHADER);t.shaderSource(n,e.vertexShader||Rt),t.compileShader(n);const s=t.createShader(t.FRAGMENT_SHADER);t.shaderSource(s,e.fragmentShader||At),t.compileShader(s),this.renderTargetProgram_=t.createProgram(),t.attachShader(this.renderTargetProgram_,n),t.attachShader(this.renderTargetProgram_,s),t.linkProgram(this.renderTargetProgram_),this.renderTargetVerticesBuffer_=t.createBuffer();const i=[-1,-1,1,-1,-1,1,1,-1,1,1,-1,1];t.bindBuffer(t.ARRAY_BUFFER,this.renderTargetVerticesBuffer_),t.bufferData(t.ARRAY_BUFFER,new Float32Array(i),t.STATIC_DRAW),this.renderTargetAttribLocation_=t.getAttribLocation(this.renderTargetProgram_,"a_position"),this.renderTargetUniformLocation_=t.getUniformLocation(this.renderTargetProgram_,"u_screenSize"),this.renderTargetOpacityLocation_=t.getUniformLocation(this.renderTargetProgram_,"u_opacity"),this.renderTargetTextureLocation_=t.getUniformLocation(this.renderTargetProgram_,"u_image"),this.uniforms_=[],e.uniforms&&Object.keys(e.uniforms).forEach(o=>{this.uniforms_.push({value:e.uniforms[o],location:t.getUniformLocation(this.renderTargetProgram_,o)})})}getRenderTargetTexture(){return this.renderTargetTexture_}getGL(){return this.gl_}init(e){const t=this.getGL(),n=[t.drawingBufferWidth*this.scaleRatio_,t.drawingBufferHeight*this.scaleRatio_];if(t.bindFramebuffer(t.FRAMEBUFFER,this.getFrameBuffer()),t.bindRenderbuffer(t.RENDERBUFFER,this.getDepthBuffer()),t.viewport(0,0,n[0],n[1]),!this.renderTargetTextureSize_||this.renderTargetTextureSize_[0]!==n[0]||this.renderTargetTextureSize_[1]!==n[1]){this.renderTargetTextureSize_=n;const s=0,i=t.RGBA,o=0,a=t.RGBA,l=t.UNSIGNED_BYTE,c=null;t.bindTexture(t.TEXTURE_2D,this.renderTargetTexture_),t.texImage2D(t.TEXTURE_2D,s,i,n[0],n[1],o,a,l,c),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MIN_FILTER,t.LINEAR),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_S,t.CLAMP_TO_EDGE),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_T,t.CLAMP_TO_EDGE),t.framebufferTexture2D(t.FRAMEBUFFER,t.COLOR_ATTACHMENT0,t.TEXTURE_2D,this.renderTargetTexture_,0),t.renderbufferStorage(t.RENDERBUFFER,t.DEPTH_COMPONENT16,n[0],n[1]),t.framebufferRenderbuffer(t.FRAMEBUFFER,t.DEPTH_ATTACHMENT,t.RENDERBUFFER,this.depthBuffer_)}}apply(e,t,n,s){const i=this.getGL(),o=e.size;if(i.bindFramebuffer(i.FRAMEBUFFER,t?t.getFrameBuffer():null),i.activeTexture(i.TEXTURE0),i.bindTexture(i.TEXTURE_2D,this.renderTargetTexture_),!t){const l=v(i.canvas);if(!e.renderTargets[l]){const c=i.getContextAttributes();c&&c.preserveDrawingBuffer&&(i.clearColor(0,0,0,0),i.clearDepth(1),i.clear(i.COLOR_BUFFER_BIT|i.DEPTH_BUFFER_BIT)),e.renderTargets[l]=!0}}i.disable(i.DEPTH_TEST),i.enable(i.BLEND),i.blendFunc(i.ONE,i.ONE_MINUS_SRC_ALPHA),i.viewport(0,0,i.drawingBufferWidth,i.drawingBufferHeight),i.bindBuffer(i.ARRAY_BUFFER,this.renderTargetVerticesBuffer_),i.useProgram(this.renderTargetProgram_),i.enableVertexAttribArray(this.renderTargetAttribLocation_),i.vertexAttribPointer(this.renderTargetAttribLocation_,2,i.FLOAT,!1,0,0),i.uniform2f(this.renderTargetUniformLocation_,o[0],o[1]),i.uniform1i(this.renderTargetTextureLocation_,0);const a=e.layerStatesArray[e.layerIndex].opacity;i.uniform1f(this.renderTargetOpacityLocation_,a),this.applyUniforms(e),n&&n(i,e),i.drawArrays(i.TRIANGLES,0,6),s&&s(i,e)}getFrameBuffer(){return this.frameBuffer_}getDepthBuffer(){return this.depthBuffer_}applyUniforms(e){const t=this.getGL();let n,s=1;this.uniforms_.forEach(function(i){if(n=typeof i.value=="function"?i.value(e):i.value,n instanceof HTMLCanvasElement||n instanceof ImageData)i.texture||(i.texture=t.createTexture()),t.activeTexture(t[`TEXTURE${s}`]),t.bindTexture(t.TEXTURE_2D,i.texture),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MIN_FILTER,t.LINEAR),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_S,t.CLAMP_TO_EDGE),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_T,t.CLAMP_TO_EDGE),n instanceof ImageData?t.texImage2D(t.TEXTURE_2D,0,t.RGBA,t.RGBA,n.width,n.height,0,t.UNSIGNED_BYTE,new Uint8Array(n.data)):t.texImage2D(t.TEXTURE_2D,0,t.RGBA,t.RGBA,t.UNSIGNED_BYTE,n),t.uniform1i(i.location,s++);else if(Array.isArray(n))switch(n.length){case 2:t.uniform2f(i.location,n[0],n[1]);return;case 3:t.uniform3f(i.location,n[0],n[1],n[2]);return;case 4:t.uniform4f(i.location,n[0],n[1],n[2],n[3]);return;default:return}else typeof n=="number"&&t.uniform1f(i.location,n)})}}const P={PROJECTION_MATRIX:"u_projectionMatrix",INVERT_PROJECTION_MATRIX:"u_invertProjectionMatrix",TIME:"u_time",ZOOM:"u_zoom",RESOLUTION:"u_resolution",ROTATION:"u_rotation",VIEWPORT_SIZE_PX:"u_viewportSizePx",PIXEL_RATIO:"u_pixelRatio",HIT_DETECTION:"u_hitDetection"},E={UNSIGNED_BYTE:Tt,UNSIGNED_SHORT:yt,UNSIGNED_INT:Pt,FLOAT:Ge},Y={};function De(r){return"shared/"+r}let Be=0;function Ct(){const r="unique/"+Be;return Be+=1,r}function Ft(r){let e=Y[r];if(!e){const t=document.createElement("canvas");t.width=1,t.height=1,t.style.position="absolute",t.style.left="0",e={users:0,context:bt(t)},Y[r]=e}return e.users+=1,e.context}function $t(r){const e=Y[r];if(!e||(e.users-=1,e.users>0))return;const t=e.context,n=t.getExtension("WEBGL_lose_context");n&&n.loseContext();const s=t.canvas;s.width=1,s.height=1,delete Y[r]}class Lt extends ot{constructor(e){super(),e=e||{},this.boundHandleWebGLContextLost_=this.handleWebGLContextLost.bind(this),this.boundHandleWebGLContextRestored_=this.handleWebGLContextRestored.bind(this),this.canvasCacheKey_=e.canvasCacheKey?De(e.canvasCacheKey):Ct(),this.gl_=Ft(this.canvasCacheKey_),this.bufferCache_={},this.extensionCache_={},this.currentProgram_=null,this.needsToBeRecreated_=!1;const t=this.gl_.canvas;t.addEventListener(X.LOST,this.boundHandleWebGLContextLost_),t.addEventListener(X.RESTORED,this.boundHandleWebGLContextRestored_),this.offsetRotateMatrix_=$(),this.offsetScaleMatrix_=$(),this.tmpMat4_=ze(),this.uniformLocationsByProgram_={},this.attribLocationsByProgram_={},this.uniforms_=[],e.uniforms&&this.setUniforms(e.uniforms),this.postProcessPasses_=e.postProcesses?e.postProcesses.map(n=>new Le({webGlContext:this.gl_,scaleRatio:n.scaleRatio,vertexShader:n.vertexShader,fragmentShader:n.fragmentShader,uniforms:n.uniforms})):[new Le({webGlContext:this.gl_})],this.shaderCompileErrors_=null,this.startTime_=Date.now(),this.maxAttributeCount_=this.gl_.getParameter(this.gl_.MAX_VERTEX_ATTRIBS)}setUniforms(e){this.uniforms_=[],this.addUniforms(e)}addUniforms(e){for(const t in e)this.uniforms_.push({name:t,value:e[t]})}canvasCacheKeyMatches(e){return this.canvasCacheKey_===De(e)}getExtension(e){if(e in this.extensionCache_)return this.extensionCache_[e];const t=this.gl_.getExtension(e);return this.extensionCache_[e]=t,t}getInstancedRenderingExtension_(){const e=this.getExtension("ANGLE_instanced_arrays");return Q(!!e,"WebGL extension 'ANGLE_instanced_arrays' is required for vector rendering"),e}bindBuffer(e){const t=this.gl_,n=v(e);let s=this.bufferCache_[n];if(!s){const i=t.createBuffer();s={buffer:e,webGlBuffer:i},this.bufferCache_[n]=s}t.bindBuffer(e.getType(),s.webGlBuffer)}flushBufferData(e){const t=this.gl_;this.bindBuffer(e),t.bufferData(e.getType(),e.getArray(),e.getUsage())}deleteBuffer(e){const t=v(e);delete this.bufferCache_[t]}disposeInternal(){const e=this.gl_.canvas;e.removeEventListener(X.LOST,this.boundHandleWebGLContextLost_),e.removeEventListener(X.RESTORED,this.boundHandleWebGLContextRestored_),$t(this.canvasCacheKey_),delete this.gl_}prepareDraw(e,t,n){const s=this.gl_,i=this.getCanvas(),o=e.size,a=e.pixelRatio;(i.width!==o[0]*a||i.height!==o[1]*a)&&(i.width=o[0]*a,i.height=o[1]*a,i.style.width=o[0]+"px",i.style.height=o[1]+"px");for(let l=this.postProcessPasses_.length-1;l>=0;l--)this.postProcessPasses_[l].init(e);s.bindTexture(s.TEXTURE_2D,null),s.clearColor(0,0,0,0),s.depthRange(0,1),s.clearDepth(1),s.clear(s.COLOR_BUFFER_BIT|s.DEPTH_BUFFER_BIT),s.enable(s.BLEND),s.blendFunc(s.ONE,t?s.ZERO:s.ONE_MINUS_SRC_ALPHA),n?(s.enable(s.DEPTH_TEST),s.depthFunc(s.LEQUAL)):s.disable(s.DEPTH_TEST)}bindFrameBuffer(e,t){const n=this.getGL();n.bindFramebuffer(n.FRAMEBUFFER,e),t&&n.framebufferTexture2D(n.FRAMEBUFFER,n.COLOR_ATTACHMENT0,n.TEXTURE_2D,t,0)}bindInitialFrameBuffer(){const e=this.getGL(),t=this.postProcessPasses_[0].getFrameBuffer();e.bindFramebuffer(e.FRAMEBUFFER,t);const n=this.postProcessPasses_[0].getRenderTargetTexture();e.framebufferTexture2D(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,n,0)}bindTexture(e,t,n){const s=this.gl_;s.activeTexture(s.TEXTURE0+t),s.bindTexture(s.TEXTURE_2D,e),s.uniform1i(this.getUniformLocation(n),t)}bindAttribute(e,t,n){const s=this.getGL();this.bindBuffer(e);const i=this.getAttributeLocation(t);s.enableVertexAttribArray(i),s.vertexAttribPointer(i,n,s.FLOAT,!1,0,0)}prepareDrawToRenderTarget(e,t,n,s){const i=this.gl_,o=t.getSize();i.bindFramebuffer(i.FRAMEBUFFER,t.getFramebuffer()),i.bindRenderbuffer(i.RENDERBUFFER,t.getDepthbuffer()),i.viewport(0,0,o[0],o[1]),i.bindTexture(i.TEXTURE_2D,t.getTexture()),i.clearColor(0,0,0,0),i.depthRange(0,1),i.clearDepth(1),i.clear(i.COLOR_BUFFER_BIT|i.DEPTH_BUFFER_BIT),i.enable(i.BLEND),i.blendFunc(i.ONE,n?i.ZERO:i.ONE_MINUS_SRC_ALPHA),s?(i.enable(i.DEPTH_TEST),i.depthFunc(i.LEQUAL)):i.disable(i.DEPTH_TEST)}drawElements(e,t){const n=this.gl_;this.getExtension("OES_element_index_uint");const s=n.UNSIGNED_INT,i=4,o=t-e,a=e*i;n.drawElements(n.TRIANGLES,o,s,a)}drawElementsInstanced(e,t,n){const s=this.gl_;this.getExtension("OES_element_index_uint");const i=this.getInstancedRenderingExtension_(),o=s.UNSIGNED_INT,a=4,l=t-e,c=e*a;i.drawElementsInstancedANGLE(s.TRIANGLES,l,o,c,n);for(let u=0;u<this.maxAttributeCount_;u++)i.vertexAttribDivisorANGLE(u,0)}finalizeDraw(e,t,n){for(let s=0,i=this.postProcessPasses_.length;s<i;s++)s===i-1?this.postProcessPasses_[s].apply(e,null,t,n):this.postProcessPasses_[s].apply(e,this.postProcessPasses_[s+1])}getCanvas(){return this.gl_.canvas}getGL(){return this.gl_}applyFrameState(e){const t=e.size,n=e.viewState.rotation,s=e.pixelRatio;this.setUniformFloatValue(P.TIME,(Date.now()-this.startTime_)*.001),this.setUniformFloatValue(P.ZOOM,e.viewState.zoom),this.setUniformFloatValue(P.RESOLUTION,e.viewState.resolution),this.setUniformFloatValue(P.PIXEL_RATIO,s),this.setUniformFloatVec2(P.VIEWPORT_SIZE_PX,[t[0],t[1]]),this.setUniformFloatValue(P.ROTATION,n)}applyHitDetectionUniform(e){const t=this.getUniformLocation(P.HIT_DETECTION);this.getGL().uniform1i(t,e?1:0),e&&this.setUniformFloatValue(P.PIXEL_RATIO,.5)}applyUniforms(e){const t=this.gl_;let n,s=0;this.uniforms_.forEach(i=>{if(n=typeof i.value=="function"?i.value(e):i.value,n instanceof HTMLCanvasElement||n instanceof HTMLImageElement||n instanceof ImageData||n instanceof WebGLTexture){n instanceof WebGLTexture&&!i.texture?(i.prevValue=void 0,i.texture=n):i.texture||(i.prevValue=void 0,i.texture=t.createTexture()),this.bindTexture(i.texture,s,i.name),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MIN_FILTER,t.LINEAR),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_S,t.CLAMP_TO_EDGE),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_T,t.CLAMP_TO_EDGE);const o=!(n instanceof HTMLImageElement)||n.complete;!(n instanceof WebGLTexture)&&o&&i.prevValue!==n&&(i.prevValue=n,t.texImage2D(t.TEXTURE_2D,0,t.RGBA,t.RGBA,t.UNSIGNED_BYTE,n)),s++}else if(Array.isArray(n)&&n.length===6)this.setUniformMatrixValue(i.name,fe(this.tmpMat4_,n));else if(Array.isArray(n)&&n.length<=4)switch(n.length){case 2:t.uniform2f(this.getUniformLocation(i.name),n[0],n[1]);return;case 3:t.uniform3f(this.getUniformLocation(i.name),n[0],n[1],n[2]);return;case 4:t.uniform4f(this.getUniformLocation(i.name),n[0],n[1],n[2],n[3]);return;default:return}else typeof n=="number"&&t.uniform1f(this.getUniformLocation(i.name),n)})}useProgram(e,t){this.disableAllAttributes_(),this.gl_.useProgram(e),this.currentProgram_=e,t&&(this.applyFrameState(t),this.applyUniforms(t))}compileShader(e,t){const n=this.gl_,s=n.createShader(t);return n.shaderSource(s,e),n.compileShader(s),s}getProgram(e,t){const n=this.gl_,s=this.compileShader(e,n.FRAGMENT_SHADER),i=this.compileShader(t,n.VERTEX_SHADER),o=n.createProgram();if(n.attachShader(o,s),n.attachShader(o,i),n.linkProgram(o),!n.getShaderParameter(s,n.COMPILE_STATUS)){const a=`Fragment shader compilation failed: ${n.getShaderInfoLog(s)}`;throw new Error(a)}if(n.deleteShader(s),!n.getShaderParameter(i,n.COMPILE_STATUS)){const a=`Vertex shader compilation failed: ${n.getShaderInfoLog(i)}`;throw new Error(a)}if(n.deleteShader(i),!n.getProgramParameter(o,n.LINK_STATUS)){const a=`GL program linking failed: ${n.getProgramInfoLog(o)}`;throw new Error(a)}return o}getUniformLocation(e){const t=v(this.currentProgram_);return this.uniformLocationsByProgram_[t]===void 0&&(this.uniformLocationsByProgram_[t]={}),this.uniformLocationsByProgram_[t][e]===void 0&&(this.uniformLocationsByProgram_[t][e]=this.gl_.getUniformLocation(this.currentProgram_,e)),this.uniformLocationsByProgram_[t][e]}getAttributeLocation(e){const t=v(this.currentProgram_);return this.attribLocationsByProgram_[t]===void 0&&(this.attribLocationsByProgram_[t]={}),this.attribLocationsByProgram_[t][e]===void 0&&(this.attribLocationsByProgram_[t][e]=this.gl_.getAttribLocation(this.currentProgram_,e)),this.attribLocationsByProgram_[t][e]}makeProjectionTransform(e,t){const n=e.size,s=e.viewState.rotation,i=e.viewState.resolution,o=e.viewState.center;return ge(t,0,0,2/(i*n[0]),2/(i*n[1]),-s,-o[0],-o[1]),t}setUniformFloatValue(e,t){this.gl_.uniform1f(this.getUniformLocation(e),t)}setUniformFloatVec2(e,t){this.gl_.uniform2fv(this.getUniformLocation(e),t)}setUniformFloatVec4(e,t){this.gl_.uniform4fv(this.getUniformLocation(e),t)}setUniformMatrixValue(e,t){this.gl_.uniformMatrix4fv(this.getUniformLocation(e),!1,t)}disableAllAttributes_(){for(let e=0;e<this.maxAttributeCount_;e++)this.gl_.disableVertexAttribArray(e)}enableAttributeArray_(e,t,n,s,i,o){const a=this.getAttributeLocation(e);a<0||(this.gl_.enableVertexAttribArray(a),this.gl_.vertexAttribPointer(a,t,n,!1,s,i),o&&this.getInstancedRenderingExtension_().vertexAttribDivisorANGLE(a,1))}enableAttributes_(e,t){const n=Dt(e);let s=0;for(let i=0;i<e.length;i++){const o=e[i];o.name&&this.enableAttributeArray_(o.name,o.size,o.type||Ge,n,s,t),s+=o.size*ke(o.type)}}enableAttributes(e){this.enableAttributes_(e,!1)}enableAttributesInstanced(e){this.enableAttributes_(e,!0)}handleWebGLContextLost(e){at(this.bufferCache_),this.currentProgram_=null,e.preventDefault()}handleWebGLContextRestored(){this.needsToBeRecreated_=!0}needsToBeRecreated(){return this.needsToBeRecreated_}createTexture(e,t,n,s){const i=this.gl_;n=n||i.createTexture();const o=s?i.NEAREST:i.LINEAR;i.bindTexture(i.TEXTURE_2D,n),i.texParameteri(i.TEXTURE_2D,i.TEXTURE_MIN_FILTER,o),i.texParameteri(i.TEXTURE_2D,i.TEXTURE_MAG_FILTER,o),i.texParameteri(i.TEXTURE_2D,i.TEXTURE_WRAP_S,i.CLAMP_TO_EDGE),i.texParameteri(i.TEXTURE_2D,i.TEXTURE_WRAP_T,i.CLAMP_TO_EDGE);const a=0,l=i.RGBA,c=0,u=i.RGBA,f=i.UNSIGNED_BYTE;return t instanceof Uint8Array?i.texImage2D(i.TEXTURE_2D,a,l,e[0],e[1],c,u,f,t):t?i.texImage2D(i.TEXTURE_2D,a,l,u,f,t):i.texImage2D(i.TEXTURE_2D,a,l,e[0],e[1],c,u,f,null),n}}function Dt(r){let e=0;for(let t=0;t<r.length;t++){const n=r[t];e+=n.size*ke(n.type)}return e}function ke(r){switch(r){case E.UNSIGNED_BYTE:return Uint8Array.BYTES_PER_ELEMENT;case E.UNSIGNED_SHORT:return Uint16Array.BYTES_PER_ELEMENT;case E.UNSIGNED_INT:return Uint32Array.BYTES_PER_ELEMENT;case E.FLOAT:default:return Float32Array.BYTES_PER_ELEMENT}}class me extends Qe{constructor(e,t){super(e),t=t||{},this.inversePixelTransform_=$(),this.postProcesses_=t.postProcesses,this.uniforms_=t.uniforms,this.helper,this.onMapChanged_=()=>{this.clearCache(),this.removeHelper()},e.addChangeListener(Ae.MAP,this.onMapChanged_),this.dispatchPreComposeEvent=this.dispatchPreComposeEvent.bind(this),this.dispatchPostComposeEvent=this.dispatchPostComposeEvent.bind(this)}dispatchPreComposeEvent(e,t){const n=this.getLayer();if(n.hasListener(w.PRECOMPOSE)){const s=new te(w.PRECOMPOSE,void 0,t,e);n.dispatchEvent(s)}}dispatchPostComposeEvent(e,t){const n=this.getLayer();if(n.hasListener(w.POSTCOMPOSE)){const s=new te(w.POSTCOMPOSE,void 0,t,e);n.dispatchEvent(s)}}reset(e){this.uniforms_=e.uniforms,this.helper&&this.helper.setUniforms(this.uniforms_)}removeHelper(){this.helper&&(this.helper.dispose(),delete this.helper)}prepareFrame(e){if(this.getLayer().getRenderSource()){let t=!0,n=-1,s;for(let o=0,a=e.layerStatesArray.length;o<a;o++){const l=e.layerStatesArray[o].layer,c=l.getRenderer();if(!(c instanceof me)){t=!0;continue}const u=l.getClassName();if((t||u!==s)&&(n+=1,t=!1),s=u,c===this)break}const i="map/"+e.mapId+"/group/"+n;(!this.helper||!this.helper.canvasCacheKeyMatches(i)||this.helper.needsToBeRecreated())&&(this.removeHelper(),this.helper=new Lt({postProcesses:this.postProcesses_,uniforms:this.uniforms_,canvasCacheKey:i}),s&&(this.helper.getCanvas().className=s),this.afterHelperCreated())}return this.prepareFrameInternal(e)}afterHelperCreated(){}prepareFrameInternal(e){return!0}clearCache(){}disposeInternal(){this.clearCache(),this.removeHelper(),this.getLayer()?.removeChangeListener(Ae.MAP,this.onMapChanged_),super.disposeInternal()}dispatchRenderEvent_(e,t,n){const s=this.getLayer();if(s.hasListener(e)){ge(this.inversePixelTransform_,0,0,n.pixelRatio,-n.pixelRatio,0,0,-n.size[1]);const i=new te(e,this.inversePixelTransform_,n,t);s.dispatchEvent(i)}}preRender(e,t){this.dispatchRenderEvent_(w.PRERENDER,e,t)}postRender(e,t){this.dispatchRenderEvent_(w.POSTRENDER,e,t)}}const ie={TILE_TEXTURE_ARRAY:"u_tileTextures",TEXTURE_PIXEL_WIDTH:"u_texturePixelWidth",TEXTURE_PIXEL_HEIGHT:"u_texturePixelHeight"};class Bt{constructor(e,t){this.name=e,this.data=t,this.texture_=null}getTexture(e){if(!this.texture_){const t=e.createTexture();e.bindTexture(e.TEXTURE_2D,t),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.NEAREST),e.texImage2D(e.TEXTURE_2D,0,e.RGBA,this.data.length/4,1,0,e.RGBA,e.UNSIGNED_BYTE,this.data),this.texture_=t}return this.texture_}delete(e){this.texture_&&e.deleteTexture(this.texture_),this.texture_=null}}function wt(r,e){return`operator_${r}_${Object.keys(e.functions).length}`}function L(r){const e=r.toString();return e.includes(".")?e:e+".0"}function Ee(r){if(r.length<2||r.length>4)throw new Error("`formatArray` can only output `vec2`, `vec3` or `vec4` arrays.");return`vec${r.length}(${r.map(L).join(", ")})`}function H(r){const e=G(r),t=e.length>3?e[3]:1;return Ee([e[0]/255,e[1]/255,e[2]/255,t])}function Nt(r){const e=rt(r);return Ee(e)}const se={};let Ot=0;function z(r){return r in se||(se[r]=Ot++),se[r]}function C(r){return L(z(r))}function ve(r){return"u_var_"+r}function je(){return{variables:{},properties:{},functions:{},bandCount:0,featureId:!1,geometryType:!1}}const oe="getBandValue",It="u_paletteTextures",We="featureId",Xe="geometryType",he=-9999999;function Ut(r,e,t,n){const s=et(r,e,t);return Te(s,e,n)}function g(r){return(e,t,n)=>{const s=t.args.length,i=new Array(s);for(let o=0;o<s;++o)i[o]=Te(t.args[o],n,e);return r(i,e)}}const Mt={[_.Get]:(r,e)=>{const n=e.args[0].value;n in r.properties||(r.properties[n]={name:n,type:e.type});let i="a_prop_"+n;return Ce(e.type,U)&&(i=`(${i} > 0.0)`),i},[_.Id]:r=>(r.featureId=!0,"a_"+We),[_.GeometryType]:r=>(r.geometryType=!0,"a_"+Xe),[_.LineMetric]:()=>"currentLineMetric",[_.Var]:(r,e)=>{const n=e.args[0].value;n in r.variables||(r.variables[n]={name:n,type:e.type});let i=ve(n);return Ce(e.type,U)&&(i=`(${i} > 0.0)`),i},[_.Has]:(r,e)=>{const n=e.args[0].value;return n in r.properties||(r.properties[n]={name:n,type:e.type}),`(a_prop_${n} != ${L(he)})`},[_.Resolution]:()=>"u_resolution",[_.Zoom]:()=>"u_zoom",[_.Time]:()=>"u_time",[_.Any]:g(r=>`(${r.join(" || ")})`),[_.All]:g(r=>`(${r.join(" && ")})`),[_.Not]:g(([r])=>`(!${r})`),[_.Equal]:g(([r,e])=>`(${r} == ${e})`),[_.NotEqual]:g(([r,e])=>`(${r} != ${e})`),[_.GreaterThan]:g(([r,e])=>`(${r} > ${e})`),[_.GreaterThanOrEqualTo]:g(([r,e])=>`(${r} >= ${e})`),[_.LessThan]:g(([r,e])=>`(${r} < ${e})`),[_.LessThanOrEqualTo]:g(([r,e])=>`(${r} <= ${e})`),[_.Multiply]:g(r=>`(${r.join(" * ")})`),[_.Divide]:g(([r,e])=>`(${r} / ${e})`),[_.Add]:g(r=>`(${r.join(" + ")})`),[_.Subtract]:g(([r,e])=>`(${r} - ${e})`),[_.Clamp]:g(([r,e,t])=>`clamp(${r}, ${e}, ${t})`),[_.Mod]:g(([r,e])=>`mod(${r}, ${e})`),[_.Pow]:g(([r,e])=>`pow(${r}, ${e})`),[_.Abs]:g(([r])=>`abs(${r})`),[_.Floor]:g(([r])=>`floor(${r})`),[_.Ceil]:g(([r])=>`ceil(${r})`),[_.Round]:g(([r])=>`floor(${r} + 0.5)`),[_.Sin]:g(([r])=>`sin(${r})`),[_.Cos]:g(([r])=>`cos(${r})`),[_.Atan]:g(([r,e])=>e!==void 0?`atan(${r}, ${e})`:`atan(${r})`),[_.Sqrt]:g(([r])=>`sqrt(${r})`),[_.Match]:g(r=>{const e=r[0],t=r[r.length-1];let n=null;for(let s=r.length-3;s>=1;s-=2){const i=r[s],o=r[s+1];n=`(${e} == ${i} ? ${o} : ${n||t})`}return n}),[_.Between]:g(([r,e,t])=>`(${r} >= ${e} && ${r} <= ${t})`),[_.Interpolate]:g(([r,e,...t])=>{let n="";for(let s=0;s<t.length-2;s+=2){const i=t[s],o=n||t[s+1],a=t[s+2],l=t[s+3];let c;r===L(1)?c=`(${e} - ${i}) / (${a} - ${i})`:c=`(pow(${r}, (${e} - ${i})) - 1.0) / (pow(${r}, (${a} - ${i})) - 1.0)`,n=`mix(${o}, ${l}, clamp(${c}, 0.0, 1.0))`}return n}),[_.Case]:g(r=>{const e=r[r.length-1];let t=null;for(let n=r.length-3;n>=0;n-=2){const s=r[n],i=r[n+1];t=`(${s} ? ${i} : ${t||e})`}return t}),[_.In]:g(([r,...e],t)=>{const n=wt("in",t),s=[];for(let i=0;i<e.length;i+=1)s.push(`  if (inputValue == ${e[i]}) { return true; }`);return t.functions[n]=`bool ${n}(float inputValue) {
${s.join(`
`)}
  return false;
}`,`${n}(${r})`}),[_.Array]:g(r=>`vec${r.length}(${r.join(", ")})`),[_.Color]:g(r=>{if(r.length===1)return`vec4(vec3(${r[0]} / 255.0), 1.0)`;if(r.length===2)return`vec4(vec3(${r[0]} / 255.0), ${r[1]})`;const e=r.slice(0,3).map(n=>`${n} / 255.0`);if(r.length===3)return`vec4(${e.join(", ")}, 1.0)`;const t=r[3];return`vec4(${e.join(", ")}, ${t})`}),[_.Band]:g(([r,e,t],n)=>{if(!(oe in n.functions)){let s="";const i=n.bandCount||1;for(let o=0;o<i;o++){const a=Math.floor(o/4);let l=o%4;o===i-1&&l===1&&(l=3);const c=`${ie.TILE_TEXTURE_ARRAY}[${a}]`;s+=`  if (band == ${o+1}.0) {
    return texture2D(${c}, v_textureCoord + vec2(dx, dy))[${l}];
  }
`}n.functions[oe]=`float getBandValue(float band, float xOffset, float yOffset) {
  float dx = xOffset / ${ie.TEXTURE_PIXEL_WIDTH};
  float dy = yOffset / ${ie.TEXTURE_PIXEL_HEIGHT};
${s}
}`}return`${oe}(${r}, ${e??"0.0"}, ${t??"0.0"})`}),[_.Palette]:(r,e)=>{const[t,...n]=e.args,s=n.length,i=new Uint8Array(s*4);for(let c=0;c<n.length;c++){const u=n[c].value,f=G(u),h=c*4;i[h]=f[0],i[h+1]=f[1],i[h+2]=f[2],i[h+3]=f[3]*255}r.paletteTextures||(r.paletteTextures=[]);const o=`${It}[${r.paletteTextures.length}]`,a=new Bt(o,i);r.paletteTextures.push(a);const l=Te(t,x,r);return`texture2D(${o}, vec2((${l} + 0.5) / ${s}.0, 0.5))`}};function Te(r,e,t){if(r instanceof tt){const n=Mt[r.operator];if(n===void 0)throw new Error(`No compiler defined for this operator: ${JSON.stringify(r.operator)}`);return n(t,r,e)}if((r.type&x)>0)return L(r.value);if((r.type&U)>0)return r.value.toString();if((r.type&M)>0)return C(r.value.toString());if((r.type&T)>0)return H(r.value);if((r.type&D)>0)return Ee(r.value);if((r.type&B)>0)return Nt(r.value);throw new Error(`Unexpected expression ${r.value} (expected type ${nt(e)})`)}function zt(){return{"fill-color":"rgba(255,255,255,0.4)","stroke-color":"#3399CC","stroke-width":1.25,"circle-radius":5,"circle-fill-color":"rgba(255,255,255,0.4)","circle-stroke-width":1.25,"circle-stroke-color":"#3399CC"}}const we=.985;function d(r,e,t,n){return Ut(e,t,n??_e(),r)}function Gt(r){const e=G(r),t=e[0]*256,n=e[1],s=e[2]*256,i=Math.round(e[3]*255);return[t+n,s+i]}const kt=`vec4 unpackColor(vec2 packedColor) {
  return vec4(
    min(floor(packedColor[0] / 256.0) / 255.0, 1.0),
    min(mod(packedColor[0], 256.0) / 255.0, 1.0),
    min(floor(packedColor[1] / 256.0) / 255.0, 1.0),
    min(mod(packedColor[1], 256.0) / 255.0, 1.0)
  );
}`;function ye(r){return r===T||r===B?2:r===D?4:1}function de(r){const e=ye(r);return e>1?`vec${e}`:"float"}function He(r,e){for(const t in e.variables){const n=e.variables[t],s=ve(n.name);let i=de(n.type);n.type===T&&(i="vec4"),r.addUniform(s,i)}for(const t in e.properties){const n=e.properties[t],s=de(n.type),i=`a_prop_${n.name}`;n.type===T?r.addAttribute(i,s,`unpackColor(${i})`,"vec4"):r.addAttribute(i,s)}for(const t in e.functions)r.addVertexShaderFunction(e.functions[t]),r.addFragmentShaderFunction(e.functions[t])}function Ve(r,e){const t={};for(const n in r.variables){const s=r.variables[n],i=ve(s.name);t[i]=()=>{const o=e[s.name];if(typeof o=="number")return o;if(typeof o=="boolean")return o?1:0;if(s.type===T){const a=[...G(o||"#eee")];return a[0]/=255,a[1]/=255,a[2]/=255,a[3]??=1,a}return typeof o=="string"?z(o):o}}return t}function Ze(r){const e={};for(const t in r.properties){const n=r.properties[t],s=i=>{const o=i.get(n.name);return n.type===T?Gt([...G(o||"#eee")]):typeof o=="string"?z(o):typeof o=="boolean"?o?1:0:o};e[`prop_${n.name}`]={size:ye(n.type),callback:s}}return e}function ae(r){return r-V(r)}function V(r){return Math.fround(r)}const jt=`
vec2 df_from(float value) {
  return vec2(value, 0.);
}

float df_float(vec2 df) {
  return df.x;
}

vec2 df_add(vec2 dfa, vec2 dfb) {
  vec2 dfc;
  float t1, t2, e;
  
  t1 = dfa.x * u_one + dfb.x * u_one;
  e = t1 * u_one - dfa.x * u_one;
  t2 = ((dfb.x - e) + (dfa.x - (t1 - e))) * u_one + dfa.y + dfb.y * u_one;
  
  dfc.x = t1 * u_one + t2 * u_one;
  dfc.y = t2 - (dfc.x - t1) * u_one;
  return dfc;
}

vec2 df_sub(vec2 dfa, vec2 dfb) {
  vec2 dfc;
  float e, t1, t2;
  
  t1 = dfa.x - dfb.x;
  e = t1 - dfa.x;
  t2 = ((-dfb.x - e) + (dfa.x - (t1 - e))) + dfa.y - dfb.y;
  
  dfc.x = t1 + t2;
  dfc.y = t2 - (dfc.x - t1);
  return dfc;
}

vec2 df_mul(vec2 dfa, vec2 dfb) {
  vec2 dfc;
  float c11, c21, c2, e, t1, t2;
  float a1, a2, b1, b2, cona, conb, split = 4097.;

  cona = dfa.x * split * u_one;
  conb = dfb.x * split * u_one;
  a1 = cona * u_one - (cona - dfa.x);
  b1 = conb * u_one - (conb - dfb.x);
  a2 = dfa.x * u_one - a1;
  b2 = dfb.x * u_one - b1 * u_one;

  c11 = dfa.x * u_one * dfb.x * u_one;
  c21 = a2 * b2 * u_one + (a2 * b1 + (a1 * b2 + (a1 * b1 - c11))) * u_one;

  c2 = dfa.x * dfb.y * u_one + dfa.y * dfb.x * u_one;

  t1 = c11 + c2 * u_one;
  e = t1 - c11 * u_one;
  t2 = dfa.y * dfb.y * u_one + ((c2 - e) + (c11 - (t1 - e))) + c21 * u_one;

  dfc.x = t1 * u_one + t2 * u_one;
  dfc.y = t2 - (dfc.x - t1) * u_one;

  return dfc;
}

vec2 df_div(vec2 dfa, vec2 dfb) {
  vec2 dfc;
  float c11, c21, c2, e, t1, t2, t11, t12, t21, t22;
  float a1, a2, b1, b2, cona, conb, split = 4097.;
  float s1, s2;
  
  s1 = dfa.x / dfb.x * u_one;
  cona = s1 * split * u_one;
  conb = dfb.x * split * u_one;
  a1 = cona - (cona - s1) * u_one;
  b1 = conb - (conb - dfb.x) * u_one;
  a2 = s1 - a1 * u_one;
  b2 = dfb.x - b1 * u_one;
  
  c11 = s1 * dfb.x * u_one;
  c21 = (((a1 * b1 - c11) + a1 * b2) + a2 * b1) + a2 * b2 * u_one;
  
  c2 = s1 * dfb.y * u_one;
  
  t1 = c11 + c2 * u_one;
  e  = t1 - c11 * u_one;
  t2 = ((c2 - e) + (c11 - (t1 - e))) + c21 * u_one;
  
  t12 = t1 + t2 * u_one;
  t22 = t2 - (t12 - t1) * u_one;
  
  t11 = dfa.x - t12 * u_one;
  e   = t11 - dfa.x * u_one;
  t21 = ((-t12 - e) + (dfa.x - (t11 - e))) + dfa.y - t22 * u_one;
  
  s2 = (t11 + t21) / dfb.x * u_one;
  
  dfc.x = s1 + s2 * u_one;
  dfc.y = s2 - (dfc.x - s1) * u_one;
  
  return dfc;
}

float df_mod(vec2 df, vec2 m) {
  vec2 q = df_div(df, m) * u_one;
  float qf = floor(q.x);
  float frac = q.x - qf + q.y * u_one;
  if (frac < 0.0) qf -= 1.0;
  if (frac >= 1.0) qf += 1.0;
  vec2 prod = df_mul(df_from(qf), m);
  vec2 rem = df_add(df_from(df.x), df_from(-prod.x)) * u_one;
  rem.y += df.y - prod.y;
  return rem.x + rem.y * u_one;
}
`,N=`#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform float u_one;
uniform mat4 u_projectionMatrix;
uniform mat4 u_invertProjectionMatrix;
uniform vec2 u_viewportSizePx;
uniform float u_pixelRatio;
uniform float u_globalAlpha;
uniform float u_time;
uniform float u_zoom;
uniform float u_resolution;
uniform float u_rotation;
uniform vec4 u_renderExtent;
uniform float u_depth;
uniform mediump int u_hitDetection;

// these 64-bits floats are split into high/low
uniform vec2 u_df_patternOriginX;
uniform vec2 u_df_patternOriginY;
uniform vec2 u_df_patternScaleRatio;

const float PI = 3.141592653589793238;
const float TWO_PI = 2.0 * PI;
float currentLineMetric = 0.; // an actual value will be used in the stroke shaders

vec2 pxToWorld(vec2 pxPos) {
  vec2 screenPos = 2.0 * pxPos / u_viewportSizePx - 1.0;
  return (u_invertProjectionMatrix * vec4(screenPos, 0.0, 1.0)).xy;
}

vec2 worldToPx(vec2 worldPos) {
  vec4 screenPos = u_projectionMatrix * vec4(worldPos, 0.0, 1.0);
  return (0.5 * screenPos.xy + 0.5) * u_viewportSizePx;
}
${kt}
${jt}
`,O=zt();class qe{constructor(){this.uniforms_=[],this.attributes_=[],this.hasSymbol_=!1,this.symbolSizeExpression_=`vec2(${L(O["circle-radius"])} + ${L(O["circle-stroke-width"]*.5)})`,this.symbolRotationExpression_="0.0",this.symbolOffsetExpression_="vec2(0.0)",this.symbolColorExpression_=H(O["circle-fill-color"]),this.texCoordExpression_="vec4(0.0, 0.0, 1.0, 1.0)",this.fragmentDiscardExpression_=null,this.shapeDiscardExpression_=null,this.symbolRotateWithView_=!1,this.hasStroke_=!1,this.strokeWidthExpression_=L(O["stroke-width"]),this.strokeColorExpression_=H(O["stroke-color"]),this.strokeOffsetExpression_="0.",this.strokeCapExpression_=C("round"),this.strokeJoinExpression_=C("round"),this.strokeMiterLimitExpression_="10.",this.strokeDistanceFieldExpression_="-1000.",this.strokePatternLengthExpression_=null,this.hasFill_=!1,this.fillColorExpression_=H(O["fill-color"]),this.fillPatternSizeExpression_=null,this.vertexShaderFunctions_=[],this.fragmentShaderFunctions_=[]}addUniform(e,t){return this.uniforms_.push({name:e,type:t}),this}addAttribute(e,t,n,s){return this.attributes_.push({name:e,type:t,varyingName:e.replace(/^a_/,"v_"),varyingType:s??t,varyingExpression:n??e}),this}setSymbolSizeExpression(e){return this.hasSymbol_=!0,this.symbolSizeExpression_=e,this}getSymbolSizeExpression(){return this.symbolSizeExpression_}setSymbolRotationExpression(e){return this.symbolRotationExpression_=e,this}setSymbolOffsetExpression(e){return this.symbolOffsetExpression_=e,this}getSymbolOffsetExpression(){return this.symbolOffsetExpression_}setSymbolColorExpression(e){return this.hasSymbol_=!0,this.symbolColorExpression_=e,this}getSymbolColorExpression(){return this.symbolColorExpression_}setTextureCoordinateExpression(e){return this.texCoordExpression_=e,this}setFragmentDiscardExpression(e){return this.fragmentDiscardExpression_=e,this}getFragmentDiscardExpression(){return this.fragmentDiscardExpression_}setShapeDiscardExpression(e){return this.shapeDiscardExpression_=e,this}getShapeDiscardExpression(){return this.shapeDiscardExpression_}setSymbolRotateWithView(e){return this.symbolRotateWithView_=e,this}setStrokeWidthExpression(e){return this.hasStroke_=!0,this.strokeWidthExpression_=e,this}setStrokeColorExpression(e){return this.hasStroke_=!0,this.strokeColorExpression_=e,this}getStrokeColorExpression(){return this.strokeColorExpression_}setStrokeOffsetExpression(e){return this.strokeOffsetExpression_=e,this}setStrokeCapExpression(e){return this.strokeCapExpression_=e,this}setStrokeJoinExpression(e){return this.strokeJoinExpression_=e,this}setStrokeMiterLimitExpression(e){return this.strokeMiterLimitExpression_=e,this}setStrokeDistanceFieldExpression(e){return this.strokeDistanceFieldExpression_=e,this}setStrokePatternLengthExpression(e){return this.strokePatternLengthExpression_=e,this}getStrokePatternLengthExpression(){return this.strokePatternLengthExpression_}setFillColorExpression(e){return this.hasFill_=!0,this.fillColorExpression_=e,this}getFillColorExpression(){return this.fillColorExpression_}setFillPatternSizeExpression(e){return this.fillPatternSizeExpression_=e,this}getFillPatternSizeExpression(){return this.fillPatternSizeExpression_}addVertexShaderFunction(e){return this.vertexShaderFunctions_.includes(e)?this:(this.vertexShaderFunctions_.push(e),this)}addFragmentShaderFunction(e){return this.fragmentShaderFunctions_.includes(e)?this:(this.fragmentShaderFunctions_.push(e),this)}getSymbolVertexShader(){return this.hasSymbol_?`${N}
${this.uniforms_.map(e=>`uniform ${e.type} ${e.name};`).join(`
`)}
attribute vec2 a_position;
attribute vec2 a_localPosition;
attribute vec2 a_hitColor;

varying vec2 v_texCoord;
varying vec2 v_quadCoord;
varying vec4 v_hitColor;
varying vec2 v_centerPx;
varying float v_angle;
varying vec2 v_quadSizePx;

${this.attributes_.map(e=>`attribute ${e.type} ${e.name};
varying ${e.varyingType} ${e.varyingName};`).join(`
`)}
${this.vertexShaderFunctions_.join(`
`)}
vec2 pxToScreen(vec2 coordPx) {
  vec2 scaled = coordPx / u_viewportSizePx / 0.5;
  return scaled;
}

vec2 screenToPx(vec2 coordScreen) {
  return (coordScreen * 0.5 + 0.5) * u_viewportSizePx;
}

void main(void) {
  v_quadSizePx = ${this.symbolSizeExpression_};
  vec2 halfSizePx = v_quadSizePx * 0.5;
  vec2 centerOffsetPx = ${this.symbolOffsetExpression_};
  vec2 offsetPx = centerOffsetPx + a_localPosition * halfSizePx * vec2(1., -1.);
  float angle = ${this.symbolRotationExpression_}${this.symbolRotateWithView_?" + u_rotation":""};
  float c = cos(-angle);
  float s = sin(-angle);
  offsetPx = vec2(c * offsetPx.x - s * offsetPx.y, s * offsetPx.x + c * offsetPx.y);
  vec4 center = u_projectionMatrix * vec4(a_position, 0.0, 1.0);
  gl_Position = center + vec4(pxToScreen(offsetPx), u_depth, 0.);
  vec4 texCoord = ${this.texCoordExpression_};
  float u = mix(texCoord.s, texCoord.p, a_localPosition.x * 0.5 + 0.5);
  float v = mix(texCoord.t, texCoord.q, a_localPosition.y * 0.5 + 0.5);
  v_texCoord = vec2(u, v);
  v_hitColor = unpackColor(a_hitColor);
  v_angle = angle;
  c = cos(-v_angle);
  s = sin(-v_angle);
  centerOffsetPx = vec2(c * centerOffsetPx.x - s * centerOffsetPx.y, s * centerOffsetPx.x + c * centerOffsetPx.y);
  v_centerPx = screenToPx(center.xy) + centerOffsetPx;
${this.attributes_.map(e=>`  ${e.varyingName} = ${e.varyingExpression};`).join(`
`)}
${this.shapeDiscardExpression_?`  if (${this.shapeDiscardExpression_}) { gl_Position = vec4(2.0, 2.0, 0.0, 0.0); }`:""}
}`:null}getSymbolFragmentShader(){return this.hasSymbol_?`${N}
${this.uniforms_.map(e=>`uniform ${e.type} ${e.name};`).join(`
`)}
varying vec2 v_texCoord;
varying vec4 v_hitColor;
varying vec2 v_centerPx;
varying float v_angle;
varying vec2 v_quadSizePx;
${this.attributes_.map(e=>`varying ${e.varyingType} ${e.varyingName};`).join(`
`)}
${this.fragmentShaderFunctions_.join(`
`)}

void main(void) {
${this.attributes_.map(e=>`  ${e.varyingType} ${e.name} = ${e.varyingName}; // assign to original attribute name`).join(`
`)}
${this.fragmentDiscardExpression_?`  if (${this.fragmentDiscardExpression_}) { discard; }`:""}
  vec2 coordsPx = gl_FragCoord.xy / u_pixelRatio - v_centerPx; // relative to center
  float c = cos(v_angle);
  float s = sin(v_angle);
  coordsPx = vec2(c * coordsPx.x - s * coordsPx.y, s * coordsPx.x + c * coordsPx.y);
  gl_FragColor = ${this.symbolColorExpression_};
  gl_FragColor.rgb *= gl_FragColor.a;
  if (u_hitDetection > 0) {
    if (gl_FragColor.a < 0.05) { discard; };
    gl_FragColor = v_hitColor;
  }
}`:null}getStrokeVertexShader(){return this.hasStroke_?`${N}
${this.uniforms_.map(e=>`uniform ${e.type} ${e.name};`).join(`
`)}
attribute vec2 a_segmentStart;
attribute vec2 a_segmentEnd;
attribute vec2 a_localPosition;
attribute float a_measureStart;
attribute float a_measureEnd;
attribute float a_angleTangentSum;
attribute float a_distanceLow;
attribute float a_distanceHigh;
attribute vec2 a_joinAngles;
attribute vec2 a_hitColor;

varying vec2 v_segmentStartPx;
varying vec2 v_segmentEndPx;
varying float v_angleStart;
varying float v_angleEnd;
varying float v_width;
varying vec4 v_hitColor;
varying float v_distancePx;
varying float v_measureStart;
varying float v_measureEnd;

${this.attributes_.map(e=>`attribute ${e.type} ${e.name};
varying ${e.varyingType} ${e.varyingName};`).join(`
`)}
${this.vertexShaderFunctions_.join(`
`)}

vec4 pxToScreen(vec2 pxPos) {
  vec2 screenPos = 2.0 * pxPos / u_viewportSizePx - 1.0;
  return vec4(screenPos, u_depth, 1.0);
}

bool isCap(float joinAngle) {
  return joinAngle < -0.1;
}

vec2 getJoinOffsetDirection(vec2 normalPx, float joinAngle) {
  float halfAngle = joinAngle / 2.0;
  float c = cos(halfAngle);
  float s = sin(halfAngle);
  vec2 angleBisectorNormal = vec2(s * normalPx.x + c * normalPx.y, -c * normalPx.x + s * normalPx.y);
  float length = 1.0 / s;
  return angleBisectorNormal * length;
}

vec2 getOffsetPoint(vec2 point, vec2 normal, float joinAngle, float offsetPx) {
  // if on a cap or the join angle is too high, offset the line along the segment normal
  if (cos(joinAngle) > 0.998 || isCap(joinAngle)) {
    return point - normal * offsetPx;
  }
  // offset is applied along the inverted normal (positive offset goes "right" relative to line direction)
  return point - getJoinOffsetDirection(normal, joinAngle) * offsetPx;
}

void main(void) {
  v_angleStart = a_joinAngles.x;
  v_angleEnd = a_joinAngles.y;
  float startEndRatio = a_localPosition.x * 0.5 + 0.5;
  currentLineMetric = mix(a_measureStart, a_measureEnd, startEndRatio);
  // we're reading the fractional part while keeping the sign (so -4.12 gives -0.12, 3.45 gives 0.45)

  float lineWidth = ${this.strokeWidthExpression_};
  float lineOffsetPx = ${this.strokeOffsetExpression_};

  // compute segment start/end in px with offset
  vec2 segmentStartPx = worldToPx(a_segmentStart);
  vec2 segmentEndPx = worldToPx(a_segmentEnd);
  vec2 tangentPx = normalize(segmentEndPx - segmentStartPx);
  vec2 normalPx = vec2(-tangentPx.y, tangentPx.x);
  segmentStartPx = getOffsetPoint(segmentStartPx, normalPx, v_angleStart, lineOffsetPx),
  segmentEndPx = getOffsetPoint(segmentEndPx, normalPx, v_angleEnd, lineOffsetPx);

  // compute current vertex position
  float normalDir = -1. * a_localPosition.y;
  float tangentDir = -1. * a_localPosition.x;
  float angle = mix(v_angleStart, v_angleEnd, startEndRatio);
  vec2 joinDirection;
  vec2 positionPx = mix(segmentStartPx, segmentEndPx, startEndRatio);
  // if angle is too high, do not make a proper join
  if (cos(angle) > ${we} || isCap(angle)) {
    joinDirection = normalPx * normalDir - tangentPx * tangentDir;
  } else {
    joinDirection = getJoinOffsetDirection(normalPx * normalDir, angle);
  }
  positionPx = positionPx + joinDirection * (lineWidth * 0.5 + 1.); // adding 1 pixel for antialiasing
  gl_Position = pxToScreen(positionPx);

  v_segmentStartPx = segmentStartPx;
  v_segmentEndPx = segmentEndPx;
  v_width = lineWidth;
  v_hitColor = unpackColor(a_hitColor);

  v_distancePx = a_distanceLow / u_resolution - (lineOffsetPx * a_angleTangentSum);
  float distanceHighPx = a_distanceHigh / u_resolution;
  ${this.strokePatternLengthExpression_!==null?`v_distancePx = mod(v_distancePx, ${this.strokePatternLengthExpression_});
  distanceHighPx = mod(distanceHighPx, ${this.strokePatternLengthExpression_});
  `:""}v_distancePx += distanceHighPx;

  v_measureStart = a_measureStart;
  v_measureEnd = a_measureEnd;
${this.attributes_.map(e=>`  ${e.varyingName} = ${e.varyingExpression};`).join(`
`)}
${this.shapeDiscardExpression_?`  if (${this.shapeDiscardExpression_}) { gl_Position = vec4(2.0, 2.0, 0.0, 0.0); }`:""}
}`:null}getStrokeFragmentShader(){return this.hasStroke_?`${N}
${this.uniforms_.map(e=>`uniform ${e.type} ${e.name};`).join(`
`)}
varying vec2 v_segmentStartPx;
varying vec2 v_segmentEndPx;
varying float v_angleStart;
varying float v_angleEnd;
varying float v_width;
varying vec4 v_hitColor;
varying float v_distancePx;
varying float v_measureStart;
varying float v_measureEnd;
${this.attributes_.map(e=>`varying ${e.varyingType} ${e.varyingName};`).join(`
`)}
${this.fragmentShaderFunctions_.join(`
`)}

bool isCap(float joinAngle) {
  return joinAngle < -0.1;
}

float segmentDistanceField(vec2 point, vec2 start, vec2 end, float width) {
  vec2 tangent = normalize(end - start);
  vec2 normal = vec2(-tangent.y, tangent.x);
  vec2 startToPoint = point - start;
  return abs(dot(startToPoint, normal)) - width * 0.5;
}

float buttCapDistanceField(vec2 point, vec2 start, vec2 end) {
  vec2 startToPoint = point - start;
  vec2 tangent = normalize(end - start);
  return dot(startToPoint, -tangent);
}

float squareCapDistanceField(vec2 point, vec2 start, vec2 end, float width) {
  return buttCapDistanceField(point, start, end) - width * 0.5;
}

float roundCapDistanceField(vec2 point, vec2 start, vec2 end, float width) {
  float onSegment = max(0., 1000. * dot(point - start, end - start)); // this is very high when inside the segment
  return length(point - start) - width * 0.5 - onSegment;
}

float roundJoinDistanceField(vec2 point, vec2 start, vec2 end, float width) {
  return roundCapDistanceField(point, start, end, width);
}

float bevelJoinField(vec2 point, vec2 start, vec2 end, float width, float joinAngle) {
  vec2 startToPoint = point - start;
  vec2 tangent = normalize(end - start);
  float c = cos(joinAngle * 0.5);
  float s = sin(joinAngle * 0.5);
  float direction = -sign(sin(joinAngle));
  vec2 bisector = vec2(c * tangent.x - s * tangent.y, s * tangent.x + c * tangent.y);
  float radius = width * 0.5 * s;
  return dot(startToPoint, bisector * direction) - radius;
}

float miterJoinDistanceField(vec2 point, vec2 start, vec2 end, float width, float joinAngle) {
  if (cos(joinAngle) > ${we}) { // avoid risking a division by zero
    return bevelJoinField(point, start, end, width, joinAngle);
  }
  float miterLength = 1. / sin(joinAngle * 0.5);
  float miterLimit = ${this.strokeMiterLimitExpression_};
  if (miterLength > miterLimit) {
    return bevelJoinField(point, start, end, width, joinAngle);
  }
  return -1000.;
}

float capDistanceField(vec2 point, vec2 start, vec2 end, float width, float capType) {
   if (capType == ${C("butt")}) {
    return buttCapDistanceField(point, start, end);
  } else if (capType == ${C("square")}) {
    return squareCapDistanceField(point, start, end, width);
  }
  return roundCapDistanceField(point, start, end, width);
}

float joinDistanceField(vec2 point, vec2 start, vec2 end, float width, float joinAngle, float joinType) {
  if (joinType == ${C("bevel")}) {
    return bevelJoinField(point, start, end, width, joinAngle);
  } else if (joinType == ${C("miter")}) {
    return miterJoinDistanceField(point, start, end, width, joinAngle);
  }
  return roundJoinDistanceField(point, start, end, width);
}

float computeSegmentPointDistance(vec2 point, vec2 start, vec2 end, float width, float joinAngle, float capType, float joinType) {
  if (isCap(joinAngle)) {
    return capDistanceField(point, start, end, width, capType);
  }
  return joinDistanceField(point, start, end, width, joinAngle, joinType);
}

float distanceFromSegment(vec2 point, vec2 start, vec2 end) {
  vec2 tangent = end - start;
  vec2 startToPoint = point - start;
  // inspire by capsule fn in https://iquilezles.org/articles/distfunctions/
  float h = clamp(dot(startToPoint, tangent) / dot(tangent, tangent), 0.0, 1.0);
  return length(startToPoint - tangent * h);
}

void main(void) {
${this.attributes_.map(e=>`  ${e.varyingType} ${e.name} = ${e.varyingName}; // assign to original attribute name`).join(`
`)}

  vec2 currentPointPx = gl_FragCoord.xy / u_pixelRatio;
  vec2 worldPos = pxToWorld(currentPointPx);
  if (
    abs(u_renderExtent[0] - u_renderExtent[2]) > 0.0 && (
      worldPos[0] < u_renderExtent[0] ||
      worldPos[1] < u_renderExtent[1] ||
      worldPos[0] > u_renderExtent[2] ||
      worldPos[1] > u_renderExtent[3]
    )
  ) {
    discard;
  }

  float segmentLengthPx = length(v_segmentEndPx - v_segmentStartPx);
  segmentLengthPx = max(segmentLengthPx, 1.17549429e-38); // avoid divide by zero
  vec2 segmentTangent = (v_segmentEndPx - v_segmentStartPx) / segmentLengthPx;
  vec2 segmentNormal = vec2(-segmentTangent.y, segmentTangent.x);
  vec2 startToPointPx = currentPointPx - v_segmentStartPx;
  float lengthToPointPx = max(0., min(dot(segmentTangent, startToPointPx), segmentLengthPx));
  float currentLengthPx = lengthToPointPx + v_distancePx;
  float currentRadiusPx = distanceFromSegment(currentPointPx, v_segmentStartPx, v_segmentEndPx);
  float currentRadiusRatio = dot(segmentNormal, startToPointPx) * 2. / v_width;
  currentLineMetric = mix(v_measureStart, v_measureEnd, lengthToPointPx / segmentLengthPx);

${this.fragmentDiscardExpression_?`  if (${this.fragmentDiscardExpression_}) { discard; }`:""}

  float capType = ${this.strokeCapExpression_};
  float joinType = ${this.strokeJoinExpression_};
  float segmentStartDistance = computeSegmentPointDistance(currentPointPx, v_segmentStartPx, v_segmentEndPx, v_width, v_angleStart, capType, joinType);
  float segmentEndDistance = computeSegmentPointDistance(currentPointPx, v_segmentEndPx, v_segmentStartPx, v_width, v_angleEnd, capType, joinType);
  float distanceField = max(
    segmentDistanceField(currentPointPx, v_segmentStartPx, v_segmentEndPx, v_width),
    max(segmentStartDistance, segmentEndDistance)
  );
  distanceField = max(distanceField, ${this.strokeDistanceFieldExpression_});

  vec4 color = ${this.strokeColorExpression_};
  color.a *= smoothstep(0.5, -0.5, distanceField);
  gl_FragColor = color;
  gl_FragColor.a *= u_globalAlpha;
  gl_FragColor.rgb *= gl_FragColor.a;
  if (u_hitDetection > 0) {
    if (gl_FragColor.a < 0.1) { discard; };
    gl_FragColor = v_hitColor;
  }
}`:null}getFillVertexShader(){return this.hasFill_?`${N}
${this.uniforms_.map(e=>`uniform ${e.type} ${e.name};`).join(`
`)}
attribute vec2 a_position;
attribute vec2 a_hitColor;

varying vec4 v_hitColor;
varying vec2 v_patternOriginPx;
varying vec2 v_patternSizePx;

${this.attributes_.map(e=>`attribute ${e.type} ${e.name};
varying ${e.varyingType} ${e.varyingName};`).join(`
`)}
${this.vertexShaderFunctions_.join(`
`)}
void main(void) {
  gl_Position = u_projectionMatrix * vec4(a_position, u_depth, 1.0);
  v_hitColor = unpackColor(a_hitColor);
${this.fillPatternSizeExpression_!==null?`
  // this computes the pattern offset in screenspace using double-float arithmetics
  v_patternSizePx = ${this.fillPatternSizeExpression_};
  vec2 patternSizeScaledX = df_mul(df_from(v_patternSizePx.x), u_df_patternScaleRatio);
  vec2 patternSizeScaledY = df_mul(df_from(v_patternSizePx.y), u_df_patternScaleRatio);
  v_patternOriginPx = vec2(
    df_mod(u_df_patternOriginX, patternSizeScaledX),
    df_mod(u_df_patternOriginY, patternSizeScaledY)
  );

  // reapply rotation to the pattern origin
  v_patternOriginPx -= u_viewportSizePx / 2.; // translate to viewport center
  v_patternOriginPx = vec2(
    cos(-u_rotation) * v_patternOriginPx.x - sin(-u_rotation) * v_patternOriginPx.y,
    sin(-u_rotation) * v_patternOriginPx.x + cos(-u_rotation) * v_patternOriginPx.y
  );
  v_patternOriginPx += u_viewportSizePx / 2.; // translate back
`:"  v_patternOriginPx = vec2(0.);"}
${this.attributes_.map(e=>`  ${e.varyingName} = ${e.varyingExpression};`).join(`
`)}
${this.shapeDiscardExpression_?`  if (${this.shapeDiscardExpression_}) { gl_Position = vec4(2.0, 2.0, 0.0, 0.0); }`:""}
}`:null}getFillFragmentShader(){return this.hasFill_?`${N}
${this.uniforms_.map(e=>`uniform ${e.type} ${e.name};`).join(`
`)}
varying vec4 v_hitColor;
varying vec2 v_patternOriginPx;
varying vec2 v_patternSizePx;
${this.attributes_.map(e=>`varying ${e.varyingType} ${e.varyingName};`).join(`
`)}
${this.fragmentShaderFunctions_.join(`
`)}

void main(void) {
${this.attributes_.map(e=>`  ${e.varyingType} ${e.name} = ${e.varyingName}; // assign to original attribute name`).join(`
`)}
  vec2 pxPos = gl_FragCoord.xy / u_pixelRatio;
  vec2 worldPos = pxToWorld(pxPos);
  if (
    abs(u_renderExtent[0] - u_renderExtent[2]) > 0.0 && (
      worldPos[0] < u_renderExtent[0] ||
      worldPos[1] < u_renderExtent[1] ||
      worldPos[0] > u_renderExtent[2] ||
      worldPos[1] > u_renderExtent[3]
    )
  ) {
    discard;
  }
${this.fragmentDiscardExpression_?`  if (${this.fragmentDiscardExpression_}) { discard; }`:""}
  gl_FragColor = ${this.fillColorExpression_};
  gl_FragColor.a *= u_globalAlpha;
  gl_FragColor.rgb *= gl_FragColor.a;
  if (u_hitDetection > 0) {
    if (gl_FragColor.a < 0.1) { discard; };
    gl_FragColor = v_hitColor;
  }
}`:null}}class K{constructor(){this.globalCounter_=0,this.refToFeature_=new Map,this.uidToRef_=new Map,this.freeGlobalRef_=[],this.polygonBatch={entries:{},geometriesCount:0,verticesCount:0,ringsCount:0},this.pointBatch={entries:{},geometriesCount:0},this.lineStringBatch={entries:{},geometriesCount:0,verticesCount:0}}addFeatures(e,t){for(let n=0;n<e.length;n++)this.addFeature(e[n],t)}addFeature(e,t){let n=e.getGeometry();n&&(t&&(n=n.clone(),n.applyTransform(t)),this.addGeometry_(n,e))}clearFeatureEntryInPointBatch_(e){const t=v(e),n=this.pointBatch.entries[t];if(n)return this.pointBatch.geometriesCount-=n.flatCoordss.length,delete this.pointBatch.entries[t],n}clearFeatureEntryInLineStringBatch_(e){const t=v(e),n=this.lineStringBatch.entries[t];if(n)return this.lineStringBatch.verticesCount-=n.verticesCount,this.lineStringBatch.geometriesCount-=n.flatCoordss.length,delete this.lineStringBatch.entries[t],n}clearFeatureEntryInPolygonBatch_(e){const t=v(e),n=this.polygonBatch.entries[t];if(n)return this.polygonBatch.verticesCount-=n.verticesCount,this.polygonBatch.ringsCount-=n.ringsCount,this.polygonBatch.geometriesCount-=n.flatCoordss.length,delete this.polygonBatch.entries[t],n}addGeometry_(e,t){const n=e.getType();switch(n){case"GeometryCollection":{const s=e.getGeometriesArray();for(const i of s)this.addGeometry_(i,t);break}case"MultiPolygon":{const s=e;this.addCoordinates_(n,s.getFlatCoordinates(),s.getEndss(),t,v(t),s.getStride());break}case"MultiLineString":{const s=e;this.addCoordinates_(n,s.getFlatCoordinates(),s.getEnds(),t,v(t),s.getStride());break}case"MultiPoint":{const s=e;this.addCoordinates_(n,s.getFlatCoordinates(),null,t,v(t),s.getStride());break}case"Polygon":{const s=e;this.addCoordinates_(n,s.getFlatCoordinates(),s.getEnds(),t,v(t),s.getStride());break}case"Point":{const s=e;this.addCoordinates_(n,s.getFlatCoordinates(),null,t,v(t),s.getStride());break}case"LineString":case"LinearRing":{const s=e,i=s.getStride();this.addCoordinates_(n,s.getFlatCoordinates(),null,t,v(t),i,s.getLayout?.());break}}}addCoordinates_(e,t,n,s,i,o,a){let l;switch(e){case"MultiPolygon":{const c=n;for(let u=0,f=c.length;u<f;u++){let h=c[u];const m=u>0?c[u-1]:null,p=m?m[m.length-1]:0,R=h[h.length-1];h=p>0?h.map(Ke=>Ke-p):h,this.addCoordinates_("Polygon",t.slice(p,R),h,s,i,o,a)}break}case"MultiLineString":{const c=n;for(let u=0,f=c.length;u<f;u++){const h=u>0?c[u-1]:0;this.addCoordinates_("LineString",t.slice(h,c[u]),null,s,i,o,a)}break}case"MultiPoint":for(let c=0,u=t.length;c<u;c+=o)this.addCoordinates_("Point",t.slice(c,c+2),null,s,i,null,null);break;case"Polygon":{const c=n;if(s instanceof Et){const h=lt(t,c);if(h.length>1){this.addCoordinates_("MultiPolygon",t,h,s,i,o,a);return}}this.polygonBatch.entries[i]||(this.polygonBatch.entries[i]=this.addRefToEntry_(i,{feature:s,flatCoordss:[],verticesCount:0,ringsCount:0,ringsVerticesCounts:[]})),l=t.length/o;const u=n.length,f=n.map((h,m,p)=>m>0?(h-p[m-1])/o:h/o);this.polygonBatch.verticesCount+=l,this.polygonBatch.ringsCount+=u,this.polygonBatch.geometriesCount++,this.polygonBatch.entries[i].flatCoordss.push(Wt(t,o)),this.polygonBatch.entries[i].ringsVerticesCounts.push(f),this.polygonBatch.entries[i].verticesCount+=l,this.polygonBatch.entries[i].ringsCount+=u;for(let h=0,m=c.length;h<m;h++){const p=h>0?c[h-1]:0;this.addCoordinates_("LinearRing",t.slice(p,c[h]),null,s,i,o,a)}break}case"Point":this.pointBatch.entries[i]||(this.pointBatch.entries[i]=this.addRefToEntry_(i,{feature:s,flatCoordss:[]})),this.pointBatch.geometriesCount++,this.pointBatch.entries[i].flatCoordss.push(t);break;case"LineString":case"LinearRing":this.lineStringBatch.entries[i]||(this.lineStringBatch.entries[i]=this.addRefToEntry_(i,{feature:s,flatCoordss:[],verticesCount:0})),l=t.length/o,this.lineStringBatch.verticesCount+=l,this.lineStringBatch.geometriesCount++,this.lineStringBatch.entries[i].flatCoordss.push(Xt(t,o,a)),this.lineStringBatch.entries[i].verticesCount+=l;break}}addRefToEntry_(e,t){const n=this.uidToRef_.get(e),s=n||this.freeGlobalRef_.pop()||++this.globalCounter_;return t.ref=s,n||(this.refToFeature_.set(s,t.feature),this.uidToRef_.set(e,s)),t}removeRef_(e,t){if(!e)throw new Error("This feature has no ref: "+t);this.refToFeature_.delete(e),this.uidToRef_.delete(t),this.freeGlobalRef_.push(e)}changeFeature(e,t){if(!this.uidToRef_.get(v(e)))return;this.removeFeature(e);let n=e.getGeometry();n&&(t&&(n=n.clone(),n.applyTransform(t)),this.addGeometry_(n,e))}removeFeature(e){let t=this.clearFeatureEntryInPointBatch_(e);t=this.clearFeatureEntryInPolygonBatch_(e)||t,t=this.clearFeatureEntryInLineStringBatch_(e)||t,t&&this.removeRef_(t.ref,v(t.feature))}clear(){this.polygonBatch.entries={},this.polygonBatch.geometriesCount=0,this.polygonBatch.verticesCount=0,this.polygonBatch.ringsCount=0,this.lineStringBatch.entries={},this.lineStringBatch.geometriesCount=0,this.lineStringBatch.verticesCount=0,this.pointBatch.entries={},this.pointBatch.geometriesCount=0,this.globalCounter_=0,this.freeGlobalRef_=[],this.refToFeature_.clear(),this.uidToRef_.clear()}getFeatureFromRef(e){return this.refToFeature_.get(e)}isEmpty(){return this.globalCounter_===0}filter(e){const t=new K;t.globalCounter_=this.globalCounter_,t.uidToRef_=this.uidToRef_,t.refToFeature_=this.refToFeature_;let n=!0;for(const s of this.refToFeature_.values())e(s)&&(t.addFeature(s),n=!1);return n?new K:t}}function Wt(r,e){return e===2?r:r.filter((t,n)=>n%e<2)}function Xt(r,e,t){return e===3&&t==="XYM"?r:e===4?r.filter((n,s)=>s%e!==2):e===3?r.map((n,s)=>s%e!==2?n:0):new Array(r.length*1.5).fill(0).map((n,s)=>s%3===2?0:r[Math.round(s/1.5)])}function Ht(){const r='function t(t,n,x=2){const o=n&&n.length,i=o?n[0]*x:t.length;let f=e(t,0,i,x,!0);const l=[];if(!f||f.next===f.prev)return l;let c,y,h;if(o&&(f=function(t,n,r,x){const o=[];for(let r=0,i=n.length;r<i;r++){const f=e(t,n[r]*x,r<i-1?n[r+1]*x:t.length,x,!1);f===f.next&&(f.steiner=!0),o.push(a(f))}o.sort(u);for(let t=0;t<o.length;t++)r=s(o[t],r);return r}(t,n,f,x)),t.length>80*x){c=t[0],y=t[1];let e=c,n=y;for(let r=x;r<i;r+=x){const x=t[r],o=t[r+1];x<c&&(c=x),o<y&&(y=o),x>e&&(e=x),o>n&&(n=o)}h=Math.max(e-c,n-y),h=0!==h?32767/h:0}return r(f,l,x,c,y,h,0),l}function e(t,e,n,r,x){let o;if(x===function(t,e,n,r){let x=0;for(let o=e,i=n-r;o<n;o+=r)x+=(t[i]-t[o])*(t[o+1]+t[i+1]),i=o;return x}(t,e,n,r)>0)for(let x=e;x<n;x+=r)o=d(x/r|0,t[x],t[x+1],o);else for(let x=n-r;x>=e;x-=r)o=d(x/r|0,t[x],t[x+1],o);return o&&b(o,o.next)&&(w(o),o=o.next),o}function n(t,e){if(!t)return t;e||(e=t);let n,r=t;do{if(n=!1,r.steiner||!b(r,r.next)&&0!==v(r.prev,r,r.next))r=r.next;else{if(w(r),r=e=r.prev,r===r.next)break;n=!0}}while(n||r!==e);return e}function r(t,e,u,s,l,a,y){if(!t)return;!y&&a&&function(t,e,n,r){let x=t;do{0===x.z&&(x.z=c(x.x,x.y,e,n,r)),x.prevZ=x.prev,x.nextZ=x.next,x=x.next}while(x!==t);x.prevZ.nextZ=null,x.prevZ=null,function(t){let e,n=1;do{let r,x=t;t=null;let o=null;for(e=0;x;){e++;let i=x,f=0;for(let t=0;t<n&&(f++,i=i.nextZ,i);t++);let u=n;for(;f>0||u>0&&i;)0!==f&&(0===u||!i||x.z<=i.z)?(r=x,x=x.nextZ,f--):(r=i,i=i.nextZ,u--),o?o.nextZ=r:t=r,r.prevZ=o,o=r;x=i}o.nextZ=null,n*=2}while(e>1)}(x)}(t,s,l,a);let h=t;for(;t.prev!==t.next;){const c=t.prev,p=t.next;if(a?o(t,s,l,a):x(t))e.push(c.i,t.i,p.i),w(t),t=p.next,h=p.next;else if((t=p)===h){y?1===y?r(t=i(n(t),e),e,u,s,l,a,2):2===y&&f(t,e,u,s,l,a):r(n(t),e,u,s,l,a,1);break}}}function x(t){const e=t.prev,n=t,r=t.next;if(v(e,n,r)>=0)return!1;const x=e.x,o=n.x,i=r.x,f=e.y,u=n.y,s=r.y,l=Math.min(x,o,i),c=Math.min(f,u,s),a=Math.max(x,o,i),y=Math.max(f,u,s);let p=r.next;for(;p!==e;){if(p.x>=l&&p.x<=a&&p.y>=c&&p.y<=y&&h(x,f,o,u,i,s,p.x,p.y)&&v(p.prev,p,p.next)>=0)return!1;p=p.next}return!0}function o(t,e,n,r){const x=t.prev,o=t,i=t.next;if(v(x,o,i)>=0)return!1;const f=x.x,u=o.x,s=i.x,l=x.y,a=o.y,y=i.y,p=Math.min(f,u,s),b=Math.min(l,a,y),M=Math.max(f,u,s),m=Math.max(l,a,y),A=c(p,b,e,n,r),g=c(M,m,e,n,r);let Z=t.prevZ,d=t.nextZ;for(;Z&&Z.z>=A&&d&&d.z<=g;){if(Z.x>=p&&Z.x<=M&&Z.y>=b&&Z.y<=m&&Z!==x&&Z!==i&&h(f,l,u,a,s,y,Z.x,Z.y)&&v(Z.prev,Z,Z.next)>=0)return!1;if(Z=Z.prevZ,d.x>=p&&d.x<=M&&d.y>=b&&d.y<=m&&d!==x&&d!==i&&h(f,l,u,a,s,y,d.x,d.y)&&v(d.prev,d,d.next)>=0)return!1;d=d.nextZ}for(;Z&&Z.z>=A;){if(Z.x>=p&&Z.x<=M&&Z.y>=b&&Z.y<=m&&Z!==x&&Z!==i&&h(f,l,u,a,s,y,Z.x,Z.y)&&v(Z.prev,Z,Z.next)>=0)return!1;Z=Z.prevZ}for(;d&&d.z<=g;){if(d.x>=p&&d.x<=M&&d.y>=b&&d.y<=m&&d!==x&&d!==i&&h(f,l,u,a,s,y,d.x,d.y)&&v(d.prev,d,d.next)>=0)return!1;d=d.nextZ}return!0}function i(t,e){let r=t;do{const n=r.prev,x=r.next.next;!b(n,x)&&M(n,r,r.next,x)&&g(n,x)&&g(x,n)&&(e.push(n.i,r.i,x.i),w(r),w(r.next),r=t=x),r=r.next}while(r!==t);return n(r)}function f(t,e,x,o,i,f){let u=t;do{let t=u.next.next;for(;t!==u.prev;){if(u.i!==t.i&&p(u,t)){let s=Z(u,t);return u=n(u,u.next),s=n(s,s.next),r(u,e,x,o,i,f,0),void r(s,e,x,o,i,f,0)}t=t.next}u=u.next}while(u!==t)}function u(t,e){let n=t.x-e.x;if(0===n&&(n=t.y-e.y,0===n)){n=(t.next.y-t.y)/(t.next.x-t.x)-(e.next.y-e.y)/(e.next.x-e.x)}return n}function s(t,e){const r=function(t,e){let n=e;const r=t.x,x=t.y;let o,i=-1/0;if(b(t,n))return n;do{if(b(t,n.next))return n.next;if(x<=n.y&&x>=n.next.y&&n.next.y!==n.y){const t=n.x+(x-n.y)*(n.next.x-n.x)/(n.next.y-n.y);if(t<=r&&t>i&&(i=t,o=n.x<n.next.x?n:n.next,t===r))return o}n=n.next}while(n!==e);if(!o)return null;const f=o,u=o.x,s=o.y;let c=1/0;n=o;do{if(r>=n.x&&n.x>=u&&r!==n.x&&y(x<s?r:i,x,u,s,x<s?i:r,x,n.x,n.y)){const e=Math.abs(x-n.y)/(r-n.x);g(n,t)&&(e<c||e===c&&(n.x>o.x||n.x===o.x&&l(o,n)))&&(o=n,c=e)}n=n.next}while(n!==f);return o}(t,e);if(!r)return e;const x=Z(r,t);return n(x,x.next),n(r,r.next)}function l(t,e){return v(t.prev,t,e.prev)<0&&v(e.next,t,t.next)<0}function c(t,e,n,r,x){return(t=1431655765&((t=858993459&((t=252645135&((t=16711935&((t=(t-n)*x|0)|t<<8))|t<<4))|t<<2))|t<<1))|(e=1431655765&((e=858993459&((e=252645135&((e=16711935&((e=(e-r)*x|0)|e<<8))|e<<4))|e<<2))|e<<1))<<1}function a(t){let e=t,n=t;do{(e.x<n.x||e.x===n.x&&e.y<n.y)&&(n=e),e=e.next}while(e!==t);return n}function y(t,e,n,r,x,o,i,f){return(x-i)*(e-f)>=(t-i)*(o-f)&&(t-i)*(r-f)>=(n-i)*(e-f)&&(n-i)*(o-f)>=(x-i)*(r-f)}function h(t,e,n,r,x,o,i,f){return!(t===i&&e===f)&&y(t,e,n,r,x,o,i,f)}function p(t,e){return t.next.i!==e.i&&t.prev.i!==e.i&&!function(t,e){let n=t;do{if(n.i!==t.i&&n.next.i!==t.i&&n.i!==e.i&&n.next.i!==e.i&&M(n,n.next,t,e))return!0;n=n.next}while(n!==t);return!1}(t,e)&&(g(t,e)&&g(e,t)&&function(t,e){let n=t,r=!1;const x=(t.x+e.x)/2,o=(t.y+e.y)/2;do{n.y>o!=n.next.y>o&&n.next.y!==n.y&&x<(n.next.x-n.x)*(o-n.y)/(n.next.y-n.y)+n.x&&(r=!r),n=n.next}while(n!==t);return r}(t,e)&&(v(t.prev,t,e.prev)||v(t,e.prev,e))||b(t,e)&&v(t.prev,t,t.next)>0&&v(e.prev,e,e.next)>0)}function v(t,e,n){return(e.y-t.y)*(n.x-e.x)-(e.x-t.x)*(n.y-e.y)}function b(t,e){return t.x===e.x&&t.y===e.y}function M(t,e,n,r){const x=A(v(t,e,n)),o=A(v(t,e,r)),i=A(v(n,r,t)),f=A(v(n,r,e));return x!==o&&i!==f||(!(0!==x||!m(t,n,e))||(!(0!==o||!m(t,r,e))||(!(0!==i||!m(n,t,r))||!(0!==f||!m(n,e,r)))))}function m(t,e,n){return e.x<=Math.max(t.x,n.x)&&e.x>=Math.min(t.x,n.x)&&e.y<=Math.max(t.y,n.y)&&e.y>=Math.min(t.y,n.y)}function A(t){return t>0?1:t<0?-1:0}function g(t,e){return v(t.prev,t,t.next)<0?v(t,e,t.next)>=0&&v(t,t.prev,e)>=0:v(t,e,t.prev)<0||v(t,t.next,e)<0}function Z(t,e){const n=F(t.i,t.x,t.y),r=F(e.i,e.x,e.y),x=t.next,o=e.prev;return t.next=e,e.prev=t,n.next=x,x.prev=n,r.next=n,n.prev=r,o.next=r,r.prev=o,r}function d(t,e,n,r){const x=F(t,e,n);return r?(x.next=r.next,x.prev=r,r.next.prev=x,r.next=x):(x.prev=x,x.next=x),x}function w(t){t.next.prev=t.prev,t.prev.next=t.next,t.prevZ&&(t.prevZ.nextZ=t.nextZ),t.nextZ&&(t.nextZ.prevZ=t.prevZ)}function F(t,e,n){return{i:t,x:e,y:n,prev:null,next:null,z:0,prevZ:null,nextZ:null,steiner:!1}}function E(t,e,n){const r=Math.sqrt((e[0]-t[0])*(e[0]-t[0])+(e[1]-t[1])*(e[1]-t[1])),x=[(e[0]-t[0])/r,(e[1]-t[1])/r],o=[-x[1],x[0]],i=Math.sqrt((n[0]-t[0])*(n[0]-t[0])+(n[1]-t[1])*(n[1]-t[1])),f=[(n[0]-t[0])/i,(n[1]-t[1])/i];let u=0===r||0===i?0:Math.acos((s=f[0]*x[0]+f[1]*x[1],l=-1,c=1,Math.min(Math.max(s,l),c)));var s,l,c;u=Math.max(u,1e-5);return f[0]*o[0]+f[1]*o[1]>0?u:2*Math.PI-u}function I(t,e){const n=e[0],r=e[1];return e[0]=t[0]*n+t[2]*r+t[4],e[1]=t[1]*n+t[3]*r+t[5],e}function z(t,e){const n=(r=e)[0]*r[3]-r[1]*r[2];var r;!function(t,e){if(!t)throw new Error(e)}(0!==n,"Transformation matrix cannot be inverted");const x=e[0],o=e[1],i=e[2],f=e[3],u=e[4],s=e[5];return t[0]=f/n,t[1]=-o/n,t[2]=-i/n,t[3]=x/n,t[4]=(i*s-f*u)/n,t[5]=-(x*s-o*u)/n,t}new Array(6);const B=[],P={vertexAttributesPosition:0,instanceAttributesPosition:0,indicesPosition:0};function N(t,e,n,r,x){const o=t[e++],i=t[e++],f=B;f.length=r;for(let n=0;n<f.length;n++)f[n]=t[e+n];let u=x?x.instanceAttributesPosition:0;return n[u++]=o,n[u++]=i,f.length&&(n.set(f,u),u+=f.length),P.instanceAttributesPosition=u,P}function R(t,e,n,r,x,o,i,f,u,s){const l=[t[e],t[e+1]],c=[t[n],t[n+1]],a=t[e+2],y=t[n+2],h=I(f,[...l]),p=I(f,[...c]);let v=-1,b=-1,M=s;const m=null!==x;if(null!==r){v=E(h,p,I(f,[...[t[r],t[r+1]]])),Math.cos(v)<=.985&&(M+=Math.tan((v-Math.PI)/2))}if(m){b=E(p,h,I(f,[...[t[x],t[x+1]]])),Math.cos(b)<=.985&&(M+=Math.tan((Math.PI-b)/2))}const A=Math.pow(2,24),g=u%A,Z=Math.floor(u/A)*A;return o.push(l[0],l[1],a,c[0],c[1],y,v,b,g,Z,s),o.push(...i),{length:u+Math.sqrt((p[0]-h[0])*(p[0]-h[0])+(p[1]-h[1])*(p[1]-h[1])),angle:M}}function S(e,n,r,x,o){const i=2+o;let f=n;const u=e.slice(f,f+o);f+=o;const s=e[f++];let l=0;const c=new Array(s-1);for(let t=0;t<s;t++)l+=e[f++],t<s-1&&(c[t]=l);const a=e.slice(f,f+2*l),y=t(a,c,2);for(let t=0;t<y.length;t++)x.push(y[t]+r.length/i);for(let t=0;t<a.length;t+=2)r.push(a[t],a[t+1],...u);return f+2*l}const T="GENERATE_POLYGON_BUFFERS",_="GENERATE_POINT_BUFFERS",O="GENERATE_LINE_STRING_BUFFERS",U=self;U.onmessage=t=>{const e=t.data;switch(e.type){case _:{const t=2,n=2,r=e.customAttributesSize,x=n+r,o=new Float32Array(e.renderInstructions),i=o.length/x*(t+r),f=Uint32Array.from([0,1,3,1,2,3]),u=Float32Array.from([-1,-1,1,-1,1,1,-1,1]),s=new Float32Array(i);let l;for(let t=0;t<o.length;t+=x)l=N(o,t,s,r,l);const c=Object.assign({indicesBuffer:f.buffer,vertexAttributesBuffer:u.buffer,instanceAttributesBuffer:s.buffer,renderInstructions:o.buffer},e);U.postMessage(c,[u.buffer,s.buffer,f.buffer,o.buffer]);break}case O:{const t=[],n=e.customAttributesSize,r=3,x=new Float32Array(e.renderInstructions);let o=0;const i=[1,0,0,1,0,0];let f,u;for(z(i,e.renderInstructionsTransform);o<x.length;){u=Array.from(x.slice(o,o+n)),o+=n,f=x[o++];const e=o,s=o+(f-1)*r,l=x[e]===x[s]&&x[e+1]===x[s+1];let c=0,a=0;for(let n=0;n<f-1;n++){let y=null;n>0?y=o+(n-1)*r:l&&(y=s-r);let h=null;n<f-2?h=o+(n+2)*r:l&&(h=e+r);const p=R(x,o+n*r,o+(n+1)*r,y,h,t,u,i,c,a);c=p.length,a=p.angle}o+=f*r}const s=Uint32Array.from([0,1,3,1,2,3]),l=Float32Array.from([-1,-1,1,-1,1,1,-1,1]),c=Float32Array.from(t),a=Object.assign({indicesBuffer:s.buffer,vertexAttributesBuffer:l.buffer,instanceAttributesBuffer:c.buffer,renderInstructions:x.buffer},e);U.postMessage(a,[l.buffer,c.buffer,s.buffer,x.buffer]);break}case T:{const t=[],n=[],r=e.customAttributesSize,x=new Float32Array(e.renderInstructions);let o=0;for(;o<x.length;)o=S(x,o,t,n,r);const i=Uint32Array.from(n),f=Float32Array.from(t),u=Float32Array.from([]),s=Object.assign({indicesBuffer:i.buffer,vertexAttributesBuffer:f.buffer,instanceAttributesBuffer:u.buffer,renderInstructions:x.buffer},e);U.postMessage(s,[f.buffer,u.buffer,i.buffer,x.buffer]);break}}};';return new Worker(typeof Blob>"u"?"data:application/javascript;base64,"+Buffer.from(r,"binary").toString("base64"):URL.createObjectURL(new Blob([r],{type:"application/javascript"})))}const le={GENERATE_POLYGON_BUFFERS:"GENERATE_POLYGON_BUFFERS",GENERATE_POINT_BUFFERS:"GENERATE_POINT_BUFFERS",GENERATE_LINE_STRING_BUFFERS:"GENERATE_LINE_STRING_BUFFERS"};function Vt(r,e){e=e||[];const t=256,n=t-1,s=Math.floor(r/t/t/t)/n,i=Math.floor(r/t/t)%t/n,o=Math.floor(r/t)%t/n,a=r%t/n;return e[0]=s*256*255+i*255,e[1]=o*256*255+a*255,e}function Zt(r){let e=0;const t=256,n=t-1;return e+=Math.round(r[0]*t*t*t*n),e+=Math.round(r[1]*t*t*n),e+=Math.round(r[2]*t*n),e+=Math.round(r[3]*n),e}function Pe(r,e,t,n){let s=0;for(const i in e){const o=e[i],a=o.callback.call(t,t.feature);let l=a?.[0]??a;l===he&&console.warn('The "has" operator might return false positives.'),l===void 0?l=he:l===null&&(l=0),r[n+s++]=l,!(!o.size||o.size===1)&&(r[n+s++]=a[1],!(o.size<3)&&(r[n+s++]=a[2],!(o.size<4)&&(r[n+s++]=a[3])))}return s}function ee(r){return Object.keys(r).reduce((e,t)=>e+(r[t].size||1),0)}function qt(r,e,t,n){const s=(2+ee(t))*r.geometriesCount;(!e||e.length!==s)&&(e=new Float32Array(s));const i=[];let o=0;for(const a in r.entries){const l=r.entries[a];for(let c=0,u=l.flatCoordss.length;c<u;c++)i[0]=l.flatCoordss[c][0],i[1]=l.flatCoordss[c][1],pe(n,i),e[o++]=i[0],e[o++]=i[1],o+=Pe(e,t,l,o)}return e}function Yt(r,e,t,n){const s=3*r.verticesCount+(1+ee(t))*r.geometriesCount;(!e||e.length!==s)&&(e=new Float32Array(s));const i=[];let o=0;for(const a in r.entries){const l=r.entries[a];for(let c=0,u=l.flatCoordss.length;c<u;c++){i.length=l.flatCoordss[c].length,Ue(l.flatCoordss[c],0,i.length,3,n,i,3),o+=Pe(e,t,l,o),e[o++]=i.length/3;for(let f=0,h=i.length;f<h;f+=3)e[o++]=i[f],e[o++]=i[f+1],e[o++]=i[f+2]}}return e}function Kt(r,e,t,n){const s=2*r.verticesCount+(1+ee(t))*r.geometriesCount+r.ringsCount;(!e||e.length!==s)&&(e=new Float32Array(s));const i=[];let o=0;for(const a in r.entries){const l=r.entries[a];for(let c=0,u=l.flatCoordss.length;c<u;c++){i.length=l.flatCoordss[c].length,Ue(l.flatCoordss[c],0,i.length,2,n,i),o+=Pe(e,t,l,o),e[o++]=l.ringsVerticesCounts[c].length;for(let f=0,h=l.ringsVerticesCounts[c].length;f<h;f++)e[o++]=l.ringsVerticesCounts[c][f];for(let f=0,h=i.length;f<h;f+=2)e[o++]=i[f],e[o++]=i[f+1]}}return e}function J(r){return(JSON.stringify(r).split("").reduce((t,n)=>(t<<5)-t+n.charCodeAt(0),0)>>>0).toString()}function be(r,e,t,n){if(`${n}radius`in r&&n!=="icon-"){let s=d(t,r[`${n}radius`],x);if(`${n}radius2`in r){const i=d(t,r[`${n}radius2`],x);s=`max(${s}, ${i})`}`${n}stroke-width`in r&&(s=`(${s} + ${d(t,r[`${n}stroke-width`],x)} * 0.5)`),e.setSymbolSizeExpression(`vec2(${s} * 2. + 0.5)`)}if(`${n}scale`in r){const s=d(t,r[`${n}scale`],B);e.setSymbolSizeExpression(`${e.getSymbolSizeExpression()} * ${s}`)}`${n}displacement`in r&&e.setSymbolOffsetExpression(d(t,r[`${n}displacement`],D)),`${n}rotation`in r&&e.setSymbolRotationExpression(d(t,r[`${n}rotation`],x)),`${n}rotate-with-view`in r&&e.setSymbolRotateWithView(!!r[`${n}rotate-with-view`])}function Ye(r,e,t,n,s){let i="vec4(0.)";if(e!==null&&(i=e),t!==null&&n!==null){const l=`smoothstep(-${n} + 0.63, -${n} - 0.58, ${r})`;i=`mix(${t}, ${i}, ${l})`}const o=`(1.0 - smoothstep(-0.63, 0.58, ${r}))`;let a=`${i} * vec4(1.0, 1.0, 1.0, ${o})`;return s!==null&&(a=`${a} * vec4(1.0, 1.0, 1.0, ${s})`),a}function Se(r,e,t,n,s){const i=new Image;i.crossOrigin=r[`${n}cross-origin`]===void 0?"anonymous":r[`${n}cross-origin`],Q(typeof r[`${n}src`]=="string",`WebGL layers do not support expressions for the ${n}src style property`),i.src=r[`${n}src`],t[`u_texture${s}_size`]=()=>i.complete?[i.width,i.height]:[0,0],e.addUniform(`u_texture${s}_size`,"vec2");const o=`u_texture${s}_size`;return t[`u_texture${s}`]=i,e.addUniform(`u_texture${s}`,"sampler2D"),o}function Re(r,e,t,n,s){let i=d(t,r[`${e}offset`],B);if(`${e}offset-origin`in r)switch(r[`${e}offset-origin`]){case"top-right":i=`vec2(${n}.x, 0.) + ${s} * vec2(-1., 0.) + ${i} * vec2(-1., 1.)`;break;case"bottom-left":i=`vec2(0., ${n}.y) + ${s} * vec2(0., -1.) + ${i} * vec2(1., -1.)`;break;case"bottom-right":i=`${n} - ${s} - ${i}`;break}return i}function Jt(r,e,t,n){n.functions.circleDistanceField=`float circleDistanceField(vec2 point, float radius) {
  return length(point) - radius;
}`,be(r,e,n,"circle-");let s=null;"circle-opacity"in r&&(s=d(n,r["circle-opacity"],x));let i="coordsPx";"circle-scale"in r&&(i=`coordsPx / ${d(n,r["circle-scale"],B)}`);let o=null;"circle-fill-color"in r&&(o=d(n,r["circle-fill-color"],T));let a=null;"circle-stroke-color"in r&&(a=d(n,r["circle-stroke-color"],T));let l=d(n,r["circle-radius"],x),c=null;"circle-stroke-width"in r&&(c=d(n,r["circle-stroke-width"],x),l=`(${l} + ${c} * 0.5)`);const u=`circleDistanceField(${i}, ${l})`,f=Ye(u,o,a,c,s);e.setSymbolColorExpression(f)}function Qt(r,e,t,n){n.functions.round=`float round(float v) {
  return sign(v) * floor(abs(v) + 0.5);
}`,n.functions.starDistanceField=`float starDistanceField(vec2 point, float numPoints, float radius, float radius2, float angle) {
  float startAngle = -PI * 0.5 + angle; // tip starts upwards and rotates clockwise with angle
  float c = cos(startAngle);
  float s = sin(startAngle);
  vec2 pointRotated = vec2(c * point.x - s * point.y, s * point.x + c * point.y);
  float alpha = TWO_PI / numPoints; // the angle of one sector
  float beta = atan(pointRotated.y, pointRotated.x);
  float gamma = round(beta / alpha) * alpha; // angle in sector
  c = cos(-gamma);
  s = sin(-gamma);
  vec2 inSector = vec2(c * pointRotated.x - s * pointRotated.y, abs(s * pointRotated.x + c * pointRotated.y));
  vec2 tipToPoint = inSector + vec2(-radius, 0.);
  vec2 edgeNormal = vec2(radius2 * sin(alpha * 0.5), -radius2 * cos(alpha * 0.5) + radius);
  return dot(normalize(edgeNormal), tipToPoint);
}`,n.functions.regularDistanceField=`float regularDistanceField(vec2 point, float numPoints, float radius, float angle) {
  float startAngle = -PI * 0.5 + angle; // tip starts upwards and rotates clockwise with angle
  float c = cos(startAngle);
  float s = sin(startAngle);
  vec2 pointRotated = vec2(c * point.x - s * point.y, s * point.x + c * point.y);
  float alpha = TWO_PI / numPoints; // the angle of one sector
  float radiusIn = radius * cos(PI / numPoints);
  float beta = atan(pointRotated.y, pointRotated.x);
  float gamma = round((beta - alpha * 0.5) / alpha) * alpha + alpha * 0.5; // angle in sector from mid
  c = cos(-gamma);
  s = sin(-gamma);
  vec2 inSector = vec2(c * pointRotated.x - s * pointRotated.y, abs(s * pointRotated.x + c * pointRotated.y));
  return inSector.x - radiusIn;
}`,be(r,e,n,"shape-");let s=null;"shape-opacity"in r&&(s=d(n,r["shape-opacity"],x));let i="coordsPx";"shape-scale"in r&&(i=`coordsPx / ${d(n,r["shape-scale"],B)}`);let o=null;"shape-fill-color"in r&&(o=d(n,r["shape-fill-color"],T));let a=null;"shape-stroke-color"in r&&(a=d(n,r["shape-stroke-color"],T));let l=null;"shape-stroke-width"in r&&(l=d(n,r["shape-stroke-width"],x));const c=d(n,r["shape-points"],x);let u="0.";"shape-angle"in r&&(u=d(n,r["shape-angle"],x));let f,h=d(n,r["shape-radius"],x);if(l!==null&&(h=`${h} + ${l} * 0.5`),"shape-radius2"in r){let p=d(n,r["shape-radius2"],x);l!==null&&(p=`${p} + ${l} * 0.5`),f=`starDistanceField(${i}, ${c}, ${h}, ${p}, ${u})`}else f=`regularDistanceField(${i}, ${c}, ${h}, ${u})`;const m=Ye(f,o,a,l,s);e.setSymbolColorExpression(m)}function en(r,e,t,n){let s="vec4(1.0)";"icon-color"in r&&(s=d(n,r["icon-color"],T)),"icon-opacity"in r&&(s=`${s} * vec4(1.0, 1.0, 1.0, ${d(n,r["icon-opacity"],x)})`);const i=J(r["icon-src"]),o=Se(r,e,t,"icon-",i);if(e.setSymbolColorExpression(`${s} * texture2D(u_texture${i}, v_texCoord)`).setSymbolSizeExpression(o),"icon-width"in r&&"icon-height"in r&&e.setSymbolSizeExpression(`vec2(${d(n,r["icon-width"],x)}, ${d(n,r["icon-height"],x)})`),"icon-offset"in r&&"icon-size"in r){const a=d(n,r["icon-size"],D),l=e.getSymbolSizeExpression();e.setSymbolSizeExpression(a);const c=Re(r,"icon-",n,"v_quadSizePx",a);e.setTextureCoordinateExpression(`(vec4((${c}).xyxy) + vec4(0., 0., ${a})) / (${l}).xyxy`)}if(be(r,e,n,"icon-"),"icon-anchor"in r){const a=d(n,r["icon-anchor"],D);let l="1.0";"icon-scale"in r&&(l=d(n,r["icon-scale"],B));let c;r["icon-anchor-x-units"]==="pixels"&&r["icon-anchor-y-units"]==="pixels"?c=`${a} * ${l}`:r["icon-anchor-x-units"]==="pixels"?c=`${a} * vec2(vec2(${l}).x, v_quadSizePx.y)`:r["icon-anchor-y-units"]==="pixels"?c=`${a} * vec2(v_quadSizePx.x, vec2(${l}).x)`:c=`${a} * v_quadSizePx`;let u=`v_quadSizePx * vec2(0.5, -0.5) + ${c} * vec2(-1., 1.)`;if("icon-anchor-origin"in r)switch(r["icon-anchor-origin"]){case"top-right":u=`v_quadSizePx * -0.5 + ${c}`;break;case"bottom-left":u=`v_quadSizePx * 0.5 - ${c}`;break;case"bottom-right":u=`v_quadSizePx * vec2(-0.5, 0.5) + ${c} * vec2(1., -1.)`;break}e.setSymbolOffsetExpression(`${e.getSymbolOffsetExpression()} + ${u}`)}}function tn(r,e,t,n){if("stroke-color"in r&&e.setStrokeColorExpression(d(n,r["stroke-color"],T)),"stroke-pattern-src"in r){const s=J(r["stroke-pattern-src"]),i=Se(r,e,t,"stroke-pattern-",s);let o=i,a="vec2(0.)";"stroke-pattern-offset"in r&&"stroke-pattern-size"in r&&(o=d(n,r["stroke-pattern-size"],D),a=Re(r,"stroke-pattern-",n,i,o));let l="0.";"stroke-pattern-spacing"in r&&(l=d(n,r["stroke-pattern-spacing"],x));let c="0.";"stroke-pattern-start-offset"in r&&(c=d(n,r["stroke-pattern-start-offset"],x)),n.functions.sampleStrokePattern=`vec4 sampleStrokePattern(sampler2D texture, vec2 textureSize, vec2 textureOffset, vec2 sampleSize, float spacingPx, float startOffsetPx, float currentLengthPx, float currentRadiusRatio, float lineWidth) {
  float currentLengthScaled = (currentLengthPx - startOffsetPx) * sampleSize.y / lineWidth;
  float spacingScaled = spacingPx * sampleSize.y / lineWidth;
  float uCoordPx = mod(currentLengthScaled, (sampleSize.x + spacingScaled));
  float isInsideOfPattern = step(uCoordPx, sampleSize.x);
  float vCoordPx = (-currentRadiusRatio * 0.5 + 0.5) * sampleSize.y;
  // make sure that we're not sampling too close to the borders to avoid interpolation with outside pixels
  uCoordPx = clamp(uCoordPx, 0.5, sampleSize.x - 0.5);
  vCoordPx = clamp(vCoordPx, 0.5, sampleSize.y - 0.5);
  vec2 texCoord = (vec2(uCoordPx, vCoordPx) + textureOffset) / textureSize;
  return texture2D(texture, texCoord) * vec4(1.0, 1.0, 1.0, isInsideOfPattern);
}`;const u=`u_texture${s}`;let f="1.";"stroke-color"in r&&(f=e.getStrokeColorExpression()),e.setStrokeColorExpression(`${f} * sampleStrokePattern(${u}, ${i}, ${a}, ${o}, ${l}, ${c}, currentLengthPx, currentRadiusRatio, v_width)`),n.functions.computeStrokePatternLength=`float computeStrokePatternLength(vec2 sampleSize, float spacingPx, float lineWidth) {
  float patternLengthPx = sampleSize.x / sampleSize.y * lineWidth;
  return patternLengthPx + spacingPx;
}`,e.setStrokePatternLengthExpression(`computeStrokePatternLength(${o}, ${l}, v_width)`)}if("stroke-width"in r&&e.setStrokeWidthExpression(d(n,r["stroke-width"],x)),"stroke-offset"in r&&e.setStrokeOffsetExpression(d(n,r["stroke-offset"],x)),"stroke-line-cap"in r&&e.setStrokeCapExpression(d(n,r["stroke-line-cap"],M)),"stroke-line-join"in r&&e.setStrokeJoinExpression(d(n,r["stroke-line-join"],M)),"stroke-miter-limit"in r&&e.setStrokeMiterLimitExpression(d(n,r["stroke-miter-limit"],x)),"stroke-line-dash"in r){n.functions.getSingleDashDistance=`float getSingleDashDistance(float distance, float radius, float dashOffset, float dashLength, float dashLengthTotal, float capType, float lineWidth) {
  float localDistance = mod(distance, dashLengthTotal);
  float distanceSegment = abs(localDistance - dashOffset - dashLength * 0.5) - dashLength * 0.5;
  distanceSegment = min(distanceSegment, dashLengthTotal - localDistance);
  if (capType == ${C("square")}) {
    distanceSegment -= lineWidth * 0.5;
  } else if (capType == ${C("round")}) {
    distanceSegment = min(distanceSegment, sqrt(distanceSegment * distanceSegment + radius * radius) - lineWidth * 0.5);
  }
  return distanceSegment;
}`;let s=r["stroke-line-dash"].map(p=>d(n,p,x));s.length%2===1&&(s=[...s,...s]);let i="0.";"stroke-line-dash-offset"in r&&(i=d(n,r["stroke-line-dash-offset"],x));const a=`dashDistanceField_${J(r["stroke-line-dash"])}`,l=s.map((p,R)=>`float dashLength${R}`).join(", "),c=s.map((p,R)=>`dashLength${R}`).join(" + ");let u="0.",f=`getSingleDashDistance(distance, radius, ${u}, dashLength0, totalDashLength, capType, lineWidth)`;for(let p=2;p<s.length;p+=2)u=`${u} + dashLength${p-2} + dashLength${p-1}`,f=`min(${f}, getSingleDashDistance(distance, radius, ${u}, dashLength${p}, totalDashLength, capType, lineWidth))`;n.functions[a]=`float ${a}(float distance, float radius, float capType, float lineWidth, ${l}) {
  float totalDashLength = ${c};
  return ${f};
}`;const h=s.map((p,R)=>`${p}`).join(", ");e.setStrokeDistanceFieldExpression(`${a}(currentLengthPx + ${i}, currentRadiusPx, capType, v_width, ${h})`);let m=s.join(" + ");e.getStrokePatternLengthExpression()&&(n.functions.combinePatternLengths=`float combinePatternLengths(float patternLength1, float patternLength2) {
  return patternLength1 * patternLength2;
}`,m=`combinePatternLengths(${e.getStrokePatternLengthExpression()}, ${m})`),e.setStrokePatternLengthExpression(m)}}function nn(r,e,t,n){if("fill-color"in r&&e.setFillColorExpression(d(n,r["fill-color"],T)),"fill-pattern-src"in r){const s=J(r["fill-pattern-src"]),i=Se(r,e,t,"fill-pattern-",s);e.setFillPatternSizeExpression(i);let o="vec2(0.)";if("fill-pattern-offset"in r&&"fill-pattern-size"in r){const c=d(n,r["fill-pattern-size"],D);e.setFillPatternSizeExpression(c),o=Re(r,"fill-pattern-",n,i,"v_patternSizePx")}n.functions.sampleFillPattern=`vec4 sampleFillPattern(sampler2D texture, vec2 textureSize, vec2 textureOffset, vec2 sampleSize, vec2 patternOriginPx, vec2 pxPosition, float sampleScaleRatio) {
  vec2 pxRelativePos = pxPosition - patternOriginPx;

  // rotate the relative position from origin by the current view rotation
  pxRelativePos = vec2(pxRelativePos.x * cos(u_rotation) - pxRelativePos.y * sin(u_rotation), pxRelativePos.x * sin(u_rotation) + pxRelativePos.y * cos(u_rotation));
  // sample position is computed according to the sample offset & size
  vec2 samplePos = mod(pxRelativePos / sampleScaleRatio, sampleSize);
  // also make sure that we're not sampling too close to the borders to avoid interpolation with outside pixels
  samplePos = clamp(samplePos, vec2(0.5), sampleSize - vec2(0.5));
  samplePos.y = sampleSize.y - samplePos.y; // invert y axis so that images appear upright
  return texture2D(texture, (samplePos + textureOffset) / textureSize);
}`;const a=`u_texture${s}`;let l="1.";"fill-color"in r&&(l=e.getFillColorExpression()),e.setFillColorExpression(`${l} * sampleFillPattern(${a}, ${i}, ${o}, v_patternSizePx, v_patternOriginPx, pxPos, df_float(u_df_patternScaleRatio))`)}}function Ne(r,e,t){const n=je(),s=new qe,i={};if("icon-src"in r?en(r,s,i,n):"shape-points"in r?Qt(r,s,i,n):"circle-radius"in r&&Jt(r,s,i,n),tn(r,s,i,n),nn(r,s,i,n),t){const l=_e(),c=d(n,t,U,l);l.mCoordinate?s.setFragmentDiscardExpression(`!${c}`):s.setShapeDiscardExpression(`!${c}`)}const o={};function a(l,c,u,f){if(!n[l])return;const h=de(u),m=ye(u);s.addAttribute(`a_${c}`,h),o[c]={size:m,callback:f}}return a("geometryType",Xe,M,l=>z(it(l.getGeometry()))),a("featureId",We,M|x,l=>{const c=l.getId()??null;return typeof c=="string"?z(c):c}),He(s,n),{builder:s,attributes:{...o,...Ze(n)},uniforms:{...i,...Ve(n,e)}}}const rn=[];let ce;function sn(){return ce||(ce=Ht()),ce}let on=0;const y={POSITION:"a_position",LOCAL_POSITION:"a_localPosition",SEGMENT_START:"a_segmentStart",SEGMENT_END:"a_segmentEnd",MEASURE_START:"a_measureStart",MEASURE_END:"a_measureEnd",ANGLE_TANGENT_SUM:"a_angleTangentSum",JOIN_ANGLES:"a_joinAngles",DISTANCE_LOW:"a_distanceLow",DISTANCE_HIGH:"a_distanceHigh"};class an{constructor(e,t,n,s){this.helper_,this.hitDetectionEnabled_=!!s,this.styleShaders=ln(e,t),this.customAttributes_={},this.uniforms_={},this.hitDetectionEnabled_&&(this.customAttributes_.hitColor={callback(){return Vt(this.ref,rn)},size:2});for(const i of this.styleShaders){for(const o in i.attributes)o in this.customAttributes_||(this.customAttributes_[o]=i.attributes[o]);for(const o in i.uniforms)o in this.uniforms_||(this.uniforms_[o]=i.uniforms[o])}this.renderPasses_=this.styleShaders.map(i=>{const o={},a=Object.entries(this.customAttributes_).map(([l,c])=>({name:l in i.attributes||l==="hitColor"?`a_${l}`:null,size:c.size||1,type:E.FLOAT}));return i.builder.getFillVertexShader()&&(o.fillRenderPass={vertexShader:i.builder.getFillVertexShader(),fragmentShader:i.builder.getFillFragmentShader(),attributesDesc:[{name:y.POSITION,size:2,type:E.FLOAT},...a],instancedAttributesDesc:[],instancePrimitiveVertexCount:3}),i.builder.getStrokeVertexShader()&&(o.strokeRenderPass={vertexShader:i.builder.getStrokeVertexShader(),fragmentShader:i.builder.getStrokeFragmentShader(),attributesDesc:[{name:y.LOCAL_POSITION,size:2,type:E.FLOAT}],instancedAttributesDesc:[{name:y.SEGMENT_START,size:2,type:E.FLOAT},{name:y.MEASURE_START,size:1,type:E.FLOAT},{name:y.SEGMENT_END,size:2,type:E.FLOAT},{name:y.MEASURE_END,size:1,type:E.FLOAT},{name:y.JOIN_ANGLES,size:2,type:E.FLOAT},{name:y.DISTANCE_LOW,size:1,type:E.FLOAT},{name:y.DISTANCE_HIGH,size:1,type:E.FLOAT},{name:y.ANGLE_TANGENT_SUM,size:1,type:E.FLOAT},...a],instancePrimitiveVertexCount:6}),i.builder.getSymbolVertexShader()&&(o.symbolRenderPass={vertexShader:i.builder.getSymbolVertexShader(),fragmentShader:i.builder.getSymbolFragmentShader(),attributesDesc:[{name:y.LOCAL_POSITION,size:2,type:E.FLOAT}],instancedAttributesDesc:[{name:y.POSITION,size:2,type:E.FLOAT},...a],instancePrimitiveVertexCount:6}),o}),this.hasFill_=this.renderPasses_.some(i=>i.fillRenderPass),this.hasStroke_=this.renderPasses_.some(i=>i.strokeRenderPass),this.hasSymbol_=this.renderPasses_.some(i=>i.symbolRenderPass),this.setHelper(n)}async generateBuffers(e,t){if(e.isEmpty())return null;const n=this.generateRenderInstructions_(e,t),[s,i,o]=await Promise.all([this.generateBuffersForType_(n.polygonInstructions,"Polygon",t),this.generateBuffersForType_(n.lineStringInstructions,"LineString",t),this.generateBuffersForType_(n.pointInstructions,"Point",t)]),a=Me($(),t);return{polygonBuffers:s,lineStringBuffers:i,pointBuffers:o,invertVerticesTransform:a}}generateRenderInstructions_(e,t){const n=this.hasFill_?Kt(e.polygonBatch,new Float32Array(0),this.customAttributes_,t):null,s=this.hasStroke_?Yt(e.lineStringBatch,new Float32Array(0),this.customAttributes_,t):null,i=this.hasSymbol_?qt(e.pointBatch,new Float32Array(0),this.customAttributes_,t):null;return{polygonInstructions:n,lineStringInstructions:s,pointInstructions:i}}generateBuffersForType_(e,t,n){if(e===null)return null;const s=on++;let i;switch(t){case"Polygon":i=le.GENERATE_POLYGON_BUFFERS;break;case"LineString":i=le.GENERATE_LINE_STRING_BUFFERS;break;case"Point":i=le.GENERATE_POINT_BUFFERS;break}const o={id:s,type:i,renderInstructions:e.buffer,renderInstructionsTransform:n,customAttributesSize:ee(this.customAttributes_)},a=sn();return a.postMessage(o,[e.buffer]),e=null,new Promise(l=>{const c=u=>{const f=u.data;if(f.id!==s||(a.removeEventListener("message",c),!this.helper_.getGL()))return;const h=new re(xe,ne).fromArrayBuffer(f.indicesBuffer),m=new re(q,ne).fromArrayBuffer(f.vertexAttributesBuffer),p=new re(q,ne).fromArrayBuffer(f.instanceAttributesBuffer);this.helper_.flushBufferData(h),this.helper_.flushBufferData(m),this.helper_.flushBufferData(p),l([h,m,p])};a.addEventListener("message",c)})}render(e,t,n){for(const s of this.renderPasses_)s.fillRenderPass&&this.renderInternal_(e.polygonBuffers[0],e.polygonBuffers[1],e.polygonBuffers[2],s.fillRenderPass,t,n),s.strokeRenderPass&&this.renderInternal_(e.lineStringBuffers[0],e.lineStringBuffers[1],e.lineStringBuffers[2],s.strokeRenderPass,t,n),s.symbolRenderPass&&this.renderInternal_(e.pointBuffers[0],e.pointBuffers[1],e.pointBuffers[2],s.symbolRenderPass,t,n)}renderInternal_(e,t,n,s,i,o){const a=e.getSize();if(a===0)return;const l=s.instancedAttributesDesc.length;if(this.helper_.useProgram(s.program,i),this.helper_.bindBuffer(t),this.helper_.bindBuffer(e),this.helper_.enableAttributes(s.attributesDesc),this.helper_.bindBuffer(n),this.helper_.enableAttributesInstanced(s.instancedAttributesDesc),o(),l){const c=s.instancedAttributesDesc.reduce((f,h)=>f+(h.size||1),0),u=n.getSize()/c;this.helper_.drawElementsInstanced(0,a,u)}else this.helper_.drawElements(0,a)}setHelper(e,t=null){this.helper_=e;for(const n of this.renderPasses_)n.fillRenderPass&&(n.fillRenderPass.program=this.helper_.getProgram(n.fillRenderPass.fragmentShader,n.fillRenderPass.vertexShader)),n.strokeRenderPass&&(n.strokeRenderPass.program=this.helper_.getProgram(n.strokeRenderPass.fragmentShader,n.strokeRenderPass.vertexShader)),n.symbolRenderPass&&(n.symbolRenderPass.program=this.helper_.getProgram(n.symbolRenderPass.fragmentShader,n.symbolRenderPass.vertexShader));this.helper_.addUniforms(this.uniforms_),t&&(t.polygonBuffers&&(this.helper_.flushBufferData(t.polygonBuffers[0]),this.helper_.flushBufferData(t.polygonBuffers[1]),this.helper_.flushBufferData(t.polygonBuffers[2])),t.lineStringBuffers&&(this.helper_.flushBufferData(t.lineStringBuffers[0]),this.helper_.flushBufferData(t.lineStringBuffers[1]),this.helper_.flushBufferData(t.lineStringBuffers[2])),t.pointBuffers&&(this.helper_.flushBufferData(t.pointBuffers[0]),this.helper_.flushBufferData(t.pointBuffers[1]),this.helper_.flushBufferData(t.pointBuffers[2])))}}function ln(r,e){const t=Array.isArray(r)?r:[r];if("style"in t[0]){const n=[],s=t,i=[];for(const o of s){const a=Array.isArray(o.style)?o.style:[o.style];let l=o.filter;o.else&&i.length&&(l=["all",...i.map(u=>["!",u])],o.filter&&l.push(o.filter),l.length<3&&(l=l[1])),o.filter&&i.push(o.filter);const c=a.map(u=>Ne(u,e,l));n.push(...c)}return n}return"builder"in t[0]?t:t.map(n=>Ne(n,e,null))}const b=new Uint8Array(4);class cn{constructor(e,t){this.helper_=e;const n=e.getGL();this.texture_=n.createTexture(),this.framebuffer_=n.createFramebuffer(),this.depthbuffer_=n.createRenderbuffer(),this.size_=t||[1,1],this.data_=new Uint8Array(0),this.dataCacheDirty_=!0,this.updateSize_()}setSize(e){ct(e,this.size_)||(this.size_[0]=e[0],this.size_[1]=e[1],this.updateSize_())}getSize(){return this.size_}clearCachedData(){this.dataCacheDirty_=!0}readAll(){if(this.dataCacheDirty_){const e=this.size_,t=this.helper_.getGL();t.bindFramebuffer(t.FRAMEBUFFER,this.framebuffer_),t.readPixels(0,0,e[0],e[1],t.RGBA,t.UNSIGNED_BYTE,this.data_),this.dataCacheDirty_=!1}return this.data_}readPixel(e,t){if(e<0||t<0||e>this.size_[0]||t>=this.size_[1])return b[0]=0,b[1]=0,b[2]=0,b[3]=0,b;this.readAll();const n=Math.floor(e)+(this.size_[1]-Math.floor(t)-1)*this.size_[0];return b[0]=this.data_[n*4],b[1]=this.data_[n*4+1],b[2]=this.data_[n*4+2],b[3]=this.data_[n*4+3],b}getTexture(){return this.texture_}getFramebuffer(){return this.framebuffer_}getDepthbuffer(){return this.depthbuffer_}updateSize_(){const e=this.size_,t=this.helper_.getGL();this.texture_=this.helper_.createTexture(e,null,this.texture_),t.bindFramebuffer(t.FRAMEBUFFER,this.framebuffer_),t.viewport(0,0,e[0],e[1]),t.framebufferTexture2D(t.FRAMEBUFFER,t.COLOR_ATTACHMENT0,t.TEXTURE_2D,this.texture_,0),t.bindRenderbuffer(t.RENDERBUFFER,this.depthbuffer_),t.renderbufferStorage(t.RENDERBUFFER,t.DEPTH_COMPONENT16,e[0],e[1]),t.framebufferRenderbuffer(t.FRAMEBUFFER,t.DEPTH_ATTACHMENT,t.RENDERBUFFER,this.depthbuffer_),this.data_=new Uint8Array(e[0]*e[1]*4)}}const Z={PATTERN_ORIGIN_X_DOUBLE:"u_df_patternOriginX",PATTERN_ORIGIN_Y_DOUBLE:"u_df_patternOriginY",PATTERN_SCALE_RATIO_DOUBLE:"u_df_patternScaleRatio",ONE:"u_one"},S=[0,0],I=[0,0],F=$(),Oe=ze();function un(r,e,t,n){ut(F,e),ft(F,t),r.setUniformMatrixValue(P.PROJECTION_MATRIX,fe(Oe,F)),Me(F,F),r.setUniformMatrixValue(P.INVERT_PROJECTION_MATRIX,fe(Oe,F)),S[0]=0,S[1]=0;const s=n.size,i=n.viewState.resolution,o=n.viewState.center;ge(F,s[0]/2,s[1]/2,1/i,1/i,0,-o[0],-o[1]),pe(F,S),I[0]=V(S[0]),I[1]=ae(S[0]),r.setUniformFloatVec2(Z.PATTERN_ORIGIN_X_DOUBLE,I),I[0]=V(S[1]),I[1]=ae(S[1]),r.setUniformFloatVec2(Z.PATTERN_ORIGIN_Y_DOUBLE,I);const a=Math.pow(2,(n.viewState.zoom+.5)%1-.5);S[0]=V(a),S[1]=ae(a),r.setUniformFloatVec2(Z.PATTERN_SCALE_RATIO_DOUBLE,S)}function fn(r,e){const t=r.viewState.projection,s=e.getSource().getWrapX()&&t.canWrapX(),i=t.getExtent(),o=r.extent,a=s?ht(i):null,l=s?Math.ceil((o[2]-i[2])/a)+1:1;return[s?Math.floor((o[0]-i[0])/a):0,l,a]}const ue={...P,...Z,RENDER_EXTENT:"u_renderExtent",GLOBAL_ALPHA:"u_globalAlpha"};class hn extends me{constructor(e,t){const n={[ue.RENDER_EXTENT]:[0,0,0,0],[ue.GLOBAL_ALPHA]:1,[ue.ONE]:1};super(e,{uniforms:n,postProcesses:t.postProcesses}),this.hitDetectionEnabled_=!t.disableHitDetection,this.hitRenderTarget_,this.sourceRevision_=-1,this.previousExtent_=dt(),this.currentTransform_=$(),this.currentFrameStateTransform_=$(),this.styleVariables_={},this.style_=[],this.styleRenderer_=null,this.buffers_=null,this.applyOptions_(t),this.batch_=new K,this.initialFeaturesAdded_=!1,this.sourceListenKeys_=null}addInitialFeatures_(e){const t=this.getLayer().getSource();let n;this.batch_.addFeatures(t.getFeatures(),n),this.sourceListenKeys_=[k(t,j.ADDFEATURE,this.handleSourceFeatureAdded_.bind(this,n)),k(t,j.CHANGEFEATURE,this.handleSourceFeatureChanged_.bind(this,n),this),k(t,j.REMOVEFEATURE,this.handleSourceFeatureDelete_,this),k(t,j.CLEAR,this.handleSourceFeatureClear_,this)]}applyOptions_(e){this.styleVariables_=e.variables,this.style_=e.style}createRenderers_(){this.buffers_=null,this.styleRenderer_=new an(this.style_,this.styleVariables_,this.helper,this.hitDetectionEnabled_)}reset(e){this.applyOptions_(e),this.helper&&this.createRenderers_(),super.reset(e)}afterHelperCreated(){this.styleRenderer_?this.styleRenderer_.setHelper(this.helper,this.buffers_):this.createRenderers_(),this.hitDetectionEnabled_&&(this.hitRenderTarget_=new cn(this.helper))}handleSourceFeatureAdded_(e,t){const n=t.feature;this.batch_.addFeature(n,e)}handleSourceFeatureChanged_(e,t){const n=t.feature;this.batch_.changeFeature(n,e)}handleSourceFeatureDelete_(e){const t=e.feature;this.batch_.removeFeature(t)}handleSourceFeatureClear_(){this.batch_.clear()}applyUniforms_(e,t){un(this.helper,this.currentFrameStateTransform_,e,t)}renderFrame(e){const t=this.helper.getGL();this.preRender(t,e);const[n,s,i]=fn(e,this.getLayer());this.helper.prepareDraw(e),this.renderWorlds(e,!1,n,s,i),this.helper.finalizeDraw(e,this.dispatchPreComposeEvent,this.dispatchPostComposeEvent);const o=this.helper.getCanvas();return this.hitDetectionEnabled_&&(this.renderWorlds(e,!0,n,s,i),this.hitRenderTarget_.clearCachedData()),this.postRender(t,e),o}prepareFrameInternal(e){this.initialFeaturesAdded_||(this.addInitialFeatures_(e),this.initialFeaturesAdded_=!0);const t=this.getLayer(),n=t.getSource(),s=e.viewState,i=!e.viewHints[Fe.ANIMATING]&&!e.viewHints[Fe.INTERACTING],o=!_t(this.previousExtent_,e.extent),a=this.sourceRevision_<n.getRevision();if(a&&(this.sourceRevision_=n.getRevision()),i&&(o||a)){const l=s.projection,c=s.resolution,u=t instanceof Ie?t.getRenderBuffer():0,f=gt(e.extent,u*c);n.loadFeatures(f,c,l),this.ready=!1;const h=this.helper.makeProjectionTransform(e,$());this.styleRenderer_.generateBuffers(this.batch_,h).then(m=>{this.buffers_&&this.disposeBuffers(this.buffers_),this.buffers_=m,this.ready=!0,this.getLayer().changed()}),this.previousExtent_=e.extent.slice()}return!0}renderWorlds(e,t,n,s,i){let o=n;t&&(this.hitRenderTarget_.setSize([Math.floor(e.size[0]/2),Math.floor(e.size[1]/2)]),this.helper.prepareDrawToRenderTarget(e,this.hitRenderTarget_,!0));do this.helper.makeProjectionTransform(e,this.currentFrameStateTransform_),pt(this.currentFrameStateTransform_,o*i,0),this.buffers_&&this.styleRenderer_.render(this.buffers_,e,()=>{this.applyUniforms_(this.buffers_.invertVerticesTransform,e),this.helper.applyHitDetectionUniform(t)});while(++o<s)}forEachFeatureAtCoordinate(e,t,n,s,i){if(Q(this.hitDetectionEnabled_,"`forEachFeatureAtCoordinate` cannot be used on a WebGL layer if the hit detection logic has been disabled using the `disableHitDetection: true` option."),!this.styleRenderer_||!this.hitDetectionEnabled_)return;const o=pe(t.coordinateToPixelTransform,e.slice()),a=this.hitRenderTarget_.readPixel(o[0]/2,o[1]/2),l=[a[0]/255,a[1]/255,a[2]/255,a[3]/255],c=Zt(l),u=this.batch_.getFeatureFromRef(c);if(u)return s(u,this.getLayer(),null)}disposeBuffers(e){const t=n=>{for(const s of n)s&&this.helper.deleteBuffer(s)};e.pointBuffers&&t(e.pointBuffers),e.lineStringBuffers&&t(e.lineStringBuffers),e.polygonBuffers&&t(e.polygonBuffers)}disposeInternal(){this.buffers_&&this.disposeBuffers(this.buffers_),this.sourceListenKeys_&&(this.sourceListenKeys_.forEach(function(e){xt(e)}),this.sourceListenKeys_=null),super.disposeInternal()}renderDeclutter(){}}const A={BLUR:"blur",GRADIENT:"gradient",RADIUS:"radius"},dn=["#00f","#0ff","#0f0","#ff0","#f00"];class En extends Ie{constructor(e){e=e||{};const t=Object.assign({},e);delete t.gradient,delete t.radius,delete t.blur,delete t.weight,super(t),this.on,this.once,this.un,this.filter_=e.filter??!0,this.styleVariables_=e.variables||{},this.gradient_=null,this.addChangeListener(A.GRADIENT,this.handleGradientChanged_),this.setGradient(e.gradient?e.gradient:dn),this.setBlur(e.blur!==void 0?e.blur:15),this.setRadius(e.radius!==void 0?e.radius:8);const n=e.weight?e.weight:"weight";this.weight_=n,this.setRenderOrder(null)}getBlur(){return this.get(A.BLUR)}getGradient(){return this.get(A.GRADIENT)}getRadius(){return this.get(A.RADIUS)}handleGradientChanged_(){this.gradient_=_n(this.getGradient())}setBlur(e){const t=this.get(A.BLUR);if(this.set(A.BLUR,e),typeof e=="number"&&typeof t=="number"){this.changed();return}this.clearRenderer()}setGradient(e){this.set(A.GRADIENT,e)}setRadius(e){const t=this.get(A.RADIUS);if(this.set(A.RADIUS,e),typeof e=="number"&&typeof t=="number"){this.changed();return}this.clearRenderer()}setFilter(e){this.filter_=e,this.changed(),this.clearRenderer()}setWeight(e){this.weight_=e,this.changed(),this.clearRenderer()}createRenderer(){const e=new qe,t=je(),n=_e(),s=d(t,this.filter_,U,n);let i=d(t,this.getRadius(),x),o=d(t,this.getBlur(),x);const a={};typeof this.getBlur()=="number"&&(o="a_blur",a.a_blur=()=>this.getBlur(),e.addUniform("a_blur","float")),typeof this.getRadius()=="number"&&(i="a_radius",a.a_radius=()=>this.getRadius(),e.addUniform("a_radius","float"));const l={};let c=null;if(typeof this.weight_=="string"||typeof this.weight_=="function"){const m=typeof this.weight_=="string"?p=>p.get(this.weight_):this.weight_;l.prop_weight={size:1,callback:p=>{const R=m(p);return R!==void 0?mt(R,0,1):1}},c="a_prop_weight",e.addAttribute("a_prop_weight","float")}else{const m=["clamp",this.weight_,0,1];c=d(t,m,x)}const u=`(${i} / max(1., ${o}))`;e.setSymbolSizeExpression(`vec2(${i} + ${o}) * 2.`).setSymbolColorExpression(`vec4(smoothstep(0., 1., (1. - length(coordsPx * 2. / v_quadSizePx)) * ${u}) * ${c})`).setStrokeColorExpression(`vec4(smoothstep(0., 1., (1. - length(currentRadiusPx * 2. / v_width)) * ${u}) * ${c})`).setStrokeWidthExpression(`(${i} + ${o}) * 2.`).setFillColorExpression(`vec4(${c})`),n.mCoordinate?e.setFragmentDiscardExpression(`!${s}`):e.setShapeDiscardExpression(`!${s}`),He(e,t);const f=Ze(t),h=Ve(t,this.styleVariables_);return new hn(this,{className:this.getClassName(),variables:this.styleVariables_,style:{builder:e,attributes:{...f,...l},uniforms:{...h,...a}},disableHitDetection:!1,postProcesses:[{fragmentShader:`
            precision mediump float;

            uniform sampler2D u_image;
            uniform sampler2D u_gradientTexture;
            uniform float u_opacity;

            varying vec2 v_texCoord;

            void main() {
              vec4 color = texture2D(u_image, v_texCoord);
              gl_FragColor.a = color.a * u_opacity;
              gl_FragColor.rgb = texture2D(u_gradientTexture, vec2(0.5, color.a)).rgb;
              gl_FragColor.rgb *= gl_FragColor.a;
            }`,uniforms:{u_gradientTexture:()=>this.gradient_,u_opacity:()=>this.getOpacity()}}]})}updateStyleVariables(e){Object.assign(this.styleVariables_,e),this.changed()}renderDeclutter(){}}function _n(r){const n=st(1,256),s=n.createLinearGradient(0,0,1,256),i=1/(r.length-1);for(let o=0,a=r.length;o<a;++o)s.addColorStop(o*i,r[o]);return n.fillStyle=s,n.fillRect(0,0,1,256),n.canvas}export{En as H};
