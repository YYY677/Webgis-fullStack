import{d as V,L as G,M as k,r as P,o as b,c as h,x,e as a,b as o,P as _,t as A,w as l,i as s,j as m}from"./index-Dz6SQmg0.js";/* empty css                */import{C as N,a as z}from"./CesiumBasemapSwitcher-UgsdVn8l.js";import{_ as T}from"./_plugin-vue_export-helper-DlAUqK2U.js";const M={id:"cesiumContainer",class:"map-container"},D={class:"basemap-label"},F={class:"switch-row"},O={class:"switch-row"},U={class:"switch-row"},B=`
  // Cesium 把高精度世界坐标拆成 high/low 两部分传入 GPU，避免大范围地理坐标在 float 精度下发生抖动。
  // 这两被 czm_computePosition() 间接读取.
  in vec3 position3DHigh;
  in vec3 position3DLow;
  // Cesium 把 geometry 的 st 属性绑定进来，所以 vertex shader 里可以直接声明它。
  // st 是 Cesium 的 geometry 属性命名约定，不能随便更改。
  in vec2 st;
  // batchId 表示“当前顶点属于当前 Primitive 批次中的第几个 GeometryInstance”。
  // Cesium 会为 Primitive 的批处理管线拼接对 batchId 的访问。
  in float batchId;
  // 传给片元 shader 的插值变量。顶点 shader 里写入它，片元 shader 就能读取。
  out vec2 v_st;
  // main() 是 WebGL/GLSL 的固定入口；结果通过全局输出变量交给 GPU，当然没有返回值。
  void main() {
    // czm_computePosition()：Cesium 内建函数，负责处理地球大坐标的高低位精度拆分，得到可安全渲染的顶点位置。
    vec4 position = czm_computePosition();
    v_st = st;
    // gl_Position：GLSL 顶点阶段的内建输出变量必须写入它，GPU 才知道顶点应投影到屏幕什么位置。
    // czm_modelViewProjectionRelativeToEye：Cesium 内建矩阵，用于把顶点从模型/世界空间变换到裁剪空间，并保持远距离精度。
    gl_Position = czm_modelViewProjectionRelativeToEye * position;
  }
`,E=`
  // v_st 是顶点 shader 传过来的插值变量，表示当前片元在矩形表面上的相对位置。 
  in vec2 v_st;
  // main() 是 WebGL/GLSL 的固定入口；结果通过全局输出变量交给 GPU，当然没有返回值。
  void main() {
    vec3 low = vec3(0.03, 0.18, 0.45);
    vec3 high = vec3(0.10, 0.95, 0.88);
    vec3 color = mix(low, high, v_st.y);
    // out_FragColor：Cesium 的 Appearance shader 片元颜色输出，必须写入它，GPU 才知道当前像素最终绘制什么颜色。
    out_FragColor = vec4(color, 0.72);
  }
`,J=`
  in vec2 v_st;
  void main() {
    // czm_frameNumber 每渲染一帧增长一次。它很适合演示动画，但速度会随实际帧率轻微变化；
    // /240.0 表示约 240 帧完成一轮；若约 60 FPS，大约每 4 秒从下扫到上一次。
    float phase = fract(czm_frameNumber / 240.0);
    // 动态扫描：扫描线所在位置 phase 与当前片元纵向位置比较
    // 例如当前 phase = 0.50：
    // 片元位置 v_st.y     abs(v_st.y - phase)     line
    // 0.10                0.40                    0.00，扫描线之外，不额外变亮
    // 0.47                0.03                    约 0.5，平滑过渡
    // 0.50                0.00                    1.00，扫描线中心，最亮
    // 0.53                0.03                    约 0.5，平滑过渡
    // 0.70                0.20                    0.00，扫描线之外，不额外变亮
    float line = 1.0 - smoothstep(0.0, 0.055, abs(v_st.y - phase));
    // 横向比例决定底色
    vec3 base = mix(vec3(0.13, 0.05, 0.32), vec3(0.55, 0.12, 0.95), v_st.x);
    // out_FragColor：Cesium 的 Appearance shader 片元颜色输出，必须写入它，GPU 才知道当前像素最终绘制什么颜色。
    out_FragColor = vec4(base + vec3(0.4, 0.95, 1.0) * line, 0.76);
  }
`,R=V({__name:"13-cesium-custom-appearance",setup(j){const C=m(!1),c=m(""),f=m(""),g=m(!0),v=m(!0),w=m(!1);let i=null,r=null;function L(t){return new Cesium.Appearance({translucent:v.value,closed:!1,vertexShaderSource:B,fragmentShaderSource:t,renderState:{depthTest:{enabled:g.value},blending:v.value?Cesium.BlendingState.ALPHA_BLEND:void 0,cull:{enabled:w.value}}})}function I(t,e,d){if(!r)return;const u=new Cesium.RectangleGeometry({rectangle:t,height:e,vertexFormat:Cesium.VertexFormat.POSITION_AND_ST});r.add(new Cesium.Primitive({geometryInstances:new Cesium.GeometryInstance({geometry:u}),appearance:L(d),asynchronous:!1,allowPicking:!1}))}function p(){r&&(r.removeAll(),I(Cesium.Rectangle.fromDegrees(116.33,39.86,116.39,39.91),2600,E),I(Cesium.Rectangle.fromDegrees(116.41,39.86,116.47,39.91),3200,J))}async function S(t){!i||t.id===c.value||(await t.activate(i),c.value=t.id,f.value=t.label)}return G(()=>{Cesium.Ion.defaultAccessToken="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJkY2MzMTFiMi00MmJhLTQ4NzEtYTEwYi05MGI0NzdkMTY1ZDkiLCJpZCI6MjE2ODA3LCJzdWIiOiJZWVk2NzciLCJpc3MiOiJodHR0cHM6Ly9hcGkuY2VzaXVtLmNvbSIsImF1ZCI6IlVudGl0bGVkIiwiaWF0IjoxNzgwOTIyNTkzfQ.7kj5EnRQOLO4PvM65nVpx3sszLKEiAqWEXkopX9f540",i=new Cesium.Viewer("cesiumContainer",{baseLayer:!1,baseLayerPicker:!1,animation:!1,timeline:!1,fullscreenButton:!1,navigationHelpButton:!1,homeButton:!1,projectionPicker:!1});const t=N.find(e=>e.id==="mars3d");t.activate(i).then(()=>{c.value=t.id,f.value=t.label}),r=i.scene.primitives.add(new Cesium.PrimitiveCollection),p(),i.camera.setView({destination:Cesium.Cartesian3.fromDegrees(116.36,39.88,3e4)})}),k(()=>{i&&i.destroy(),i=null,r=null}),(t,e)=>{const d=P("el-card"),u=P("el-switch"),y=P("el-scrollbar");return b(),h("div",M,[C.value?(b(),h("div",{key:0,class:"panel-overlay",onClick:e[0]||(e[0]=n=>C.value=!1)})):x("",!0),a("div",{class:"top-right-controls",onClick:e[2]||(e[2]=_(()=>{},["stop"]))},[o(z,{activate:S,initial:c.value,onToggle:e[1]||(e[1]=n=>C.value=n)},null,8,["initial"])]),a("div",D,A(f.value),1),a("div",{class:"left-panel",onClick:e[6]||(e[6]=_(()=>{},["stop"]))},[o(y,{"max-height":"calc(100vh - 80px)"},{default:l(()=>[o(d,{shadow:"never",class:"panel-card"},{header:l(()=>[...e[7]||(e[7]=[s("13 · 自定义 Appearance",-1)])]),default:l(()=>[e[8]||(e[8]=a("p",{class:"card-desc"},[s("Primitive 不接收 MaterialProperty。这里直接给 "),a("code",null,"Appearance"),s(" 传入顶点和片元 GLSL，掌握几何属性进入 GPU 的最短路径。")],-1)),e[9]||(e[9]=a("div",{class:"legend"},[a("i",{class:"gradient-dot"}),s("静态渐变面 "),a("i",{class:"scan-dot"}),s("动态扫描面")],-1)),e[10]||(e[10]=a("p",{class:"tip"},[s("顶点 Shader 传出 "),a("code",null,"st"),s(" 纹理坐标；片元 Shader 用它计算颜色。动态效果读取 Cesium 内置 "),a("code",null,"czm_frameNumber"),s("，不需要 DrawCommand。"),a("code",null,"batchId"),s(" 虽未由本页 GLSL 手写使用，仍须声明给 Cesium 的 Primitive 批处理管线。")],-1))]),_:1}),o(d,{shadow:"never",class:"panel-card"},{header:l(()=>[...e[11]||(e[11]=[s("RenderState",-1)])]),default:l(()=>[a("div",F,[e[12]||(e[12]=a("span",null,"深度测试",-1)),o(u,{modelValue:g.value,"onUpdate:modelValue":e[3]||(e[3]=n=>g.value=n),onChange:p},null,8,["modelValue"])]),a("div",O,[e[13]||(e[13]=a("span",null,"透明混合",-1)),o(u,{modelValue:v.value,"onUpdate:modelValue":e[4]||(e[4]=n=>v.value=n),onChange:p},null,8,["modelValue"])]),a("div",U,[e[14]||(e[14]=a("span",null,"背面剔除",-1)),o(u,{modelValue:w.value,"onUpdate:modelValue":e[5]||(e[5]=n=>w.value=n),onChange:p},null,8,["modelValue"])]),e[15]||(e[15]=a("p",{class:"tip"},"这些状态不改变几何或 Shader 本身，却决定像素是否通过深度、如何和背景混合、是否渲染背面。",-1))]),_:1}),o(d,{shadow:"never",class:"panel-card"},{header:l(()=>[...e[16]||(e[16]=[s("Primitive 渲染链",-1)])]),default:l(()=>[e[17]||(e[17]=a("pre",null,`RectangleGeometry
    → POSITION_AND_ST
    → Appearance(vertex + fragment)
    → Primitive
    → DrawCommand（Cesium 内部生成）`,-1)),e[18]||(e[18]=a("p",{class:"tip"},[s("第 05 页的 "),a("code",null,"MaterialAppearance"),s(" 让 Cesium 拼装材质 Shader；本页直接提供完整的顶点 / 片元入口。")],-1))]),_:1})]),_:1})])])}}}),Z=T(R,[["__scopeId","data-v-bca4ad7f"]]);export{Z as default};
