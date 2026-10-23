import{St as e,an as t,ct as n,d as r,in as i,n as a,on as o,xn as s,xt as c}from"./index-22ZnSezq.js";var l,u,d,f;function p(p,m=1/0,h=null){u||=new e(2,2,1,1),d||=new o({uniforms:{blitTexture:new s(p)},vertexShader:`
			varying vec2 vUv;
			void main(){
				vUv = uv;
				gl_Position = vec4(position.xy * 1.0,0.,.999999);
			}`,fragmentShader:`
			uniform sampler2D blitTexture; 
			varying vec2 vUv;

			void main(){ 
				gl_FragColor = vec4(vUv.xy, 0, 1);
				
				#ifdef IS_SRGB
				gl_FragColor = sRGBTransferOETF( texture2D( blitTexture, vUv) );
				#else
				gl_FragColor = texture2D( blitTexture, vUv);
				#endif
			}`}),d.uniforms.blitTexture.value=p,d.defines.IS_SRGB=p.colorSpace==i,d.needsUpdate=!0,f||(f=new n(u,d),f.frustumCulled=!1);let g=new c,_=new t;_.add(f),h===null&&(h=l=new a({antialias:!1}));let v=Math.min(p.image.width,m),y=Math.min(p.image.height,m);h.setSize(v,y),h.clear(),h.render(_,g);let b=document.createElement(`canvas`),x=b.getContext(`2d`);b.width=v,b.height=y,x.drawImage(h.domElement,0,0,v,y);let S=new r(b);return S.minFilter=p.minFilter,S.magFilter=p.magFilter,S.wrapS=p.wrapS,S.wrapT=p.wrapT,S.colorSpace=p.colorSpace,S.name=p.name,l&&=(l.forceContextLoss(),l.dispose(),null),S}export{p as decompress};