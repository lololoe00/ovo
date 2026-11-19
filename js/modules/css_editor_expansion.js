// 放大时移动同一个编辑框与查找工具，保留原有内容、监听器及查找/替换状态。
(() => {
    let active=null;
    const expandIcon='<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3h7v7M21 3l-7 7M10 21H3v-7M3 21l7-7"/></svg>';
    const shrinkIcon='<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 3l-7 7V3M14 10h7M3 21l7-7v7M10 14H3"/></svg>';
    function close() {
        if(!active)return;
        const {toolbar,textarea,toolbarPlace,textareaPlace,overlay,button,disabled,readOnly,onKey,observer,bodyOverflow}=active;
        active=null;observer.disconnect();document.removeEventListener('keydown',onKey,true);
        toolbarPlace.replaceWith(toolbar);textareaPlace.replaceWith(textarea);
        textarea.disabled=disabled;textarea.readOnly=readOnly;
        toolbar.classList.remove('css-editor-toolbar');textarea.classList.remove('css-editor-textarea');
        button.innerHTML=expandIcon;button.title='放大 CSS 编辑框';button.setAttribute('aria-label',button.title);button.setAttribute('aria-expanded','false');
        overlay.remove();document.body.style.overflow=bodyOverflow;refreshSearch(textarea);button.focus({preventScroll:true});
    }
    function open(toolbar,textarea,button) {
        if(active){if(active.textarea===textarea){close();return;}close();}
        const toolbarPlace=document.createComment('CSS toolbar position'),textareaPlace=document.createComment('CSS textarea position');
        toolbar.replaceWith(toolbarPlace);textarea.replaceWith(textareaPlace);
        const overlay=document.createElement('div'),dialog=document.createElement('div');
        overlay.className='modal-overlay visible css-editor-overlay';dialog.className='css-editor-dialog';
        dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-label','放大 CSS 编辑框');
        toolbar.classList.add('css-editor-toolbar');textarea.classList.add('css-editor-textarea');
        dialog.append(toolbar,textarea);overlay.append(dialog);document.body.append(overlay);
        button.innerHTML=shrinkIcon;button.title='缩小 CSS 编辑框';button.setAttribute('aria-label',button.title);button.setAttribute('aria-expanded','true');
        const bodyOverflow=document.body.style.overflow;document.body.style.overflow='hidden';
        const chatId=typeof currentChatId==='undefined'?null:currentChatId,chatType=typeof currentChatType==='undefined'?null:currentChatType;
        const disabled=textarea.disabled,readOnly=textarea.readOnly;
        if(disabled){textarea.disabled=false;textarea.readOnly=true;}
        const onKey=e=>{
            if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();return;}
            if(e.key!=='Tab')return;
            const nodes=[...dialog.querySelectorAll('button,input,textarea')].filter(n=>!n.disabled&&n.getClientRects().length);
            if(!nodes.length)return;
            if(e.shiftKey&&document.activeElement===nodes[0]){e.preventDefault();nodes.at(-1).focus();}
            else if(!e.shiftKey&&document.activeElement===nodes.at(-1)){e.preventDefault();nodes[0].focus();}
        };
        const observer=new MutationObserver(()=>{if(!toolbarPlace.isConnected||!textareaPlace.isConnected||(typeof currentChatId!=='undefined'&&currentChatId!==chatId)||(typeof currentChatType!=='undefined'&&currentChatType!==chatType))close();});
        active={toolbar,textarea,toolbarPlace,textareaPlace,overlay,button,disabled,readOnly,onKey,observer,bodyOverflow};
        document.addEventListener('keydown',onKey,true);observer.observe(document.body,{childList:true,subtree:true});
        overlay.addEventListener('click',e=>{if(e.target===overlay)close();});
        refreshSearch(textarea);
        button.focus({preventScroll:true});
    }
    function attach(toolbar,textarea) {
        if(toolbar.querySelector('.css-editor-expand-btn'))return;
        const search=toolbar.querySelector('.toolbar-toggle-btn');if(!search)return;
        const actions=document.createElement('div');actions.className='css-editor-actions';
        search.replaceWith(actions);actions.append(search);
        const button=document.createElement('button');button.type='button';button.className='toolbar-toggle-btn css-editor-expand-btn';button.innerHTML=expandIcon;
        button.title='放大 CSS 编辑框';button.setAttribute('aria-label',button.title);button.setAttribute('aria-expanded','false');actions.append(button);
        button.addEventListener('click',()=>open(toolbar,textarea,button));
    }
    // Paint matches independently of native textarea selection (including while search has focus).
    const searchLayers = new WeakMap();
    function searchLayer(textarea) {
        if(searchLayers.has(textarea))return searchLayers.get(textarea);
        const layer=document.createElement('div');
        layer.setAttribute('aria-hidden','true');
        layer.className='css-search-highlight-layer';
        layer.style.cssText='position:absolute;pointer-events:none;overflow:hidden;z-index:4;color:transparent;background:transparent;box-sizing:border-box;margin:0;';
        let mark=null,range=null;
        function layout() {
            if(!textarea.isConnected)return;
            const parent=textarea.parentElement;
            if(getComputedStyle(parent).position==='static')parent.style.position='relative';
            if(layer.parentElement!==parent)parent.append(layer);
            const style=getComputedStyle(textarea),r=textarea.getBoundingClientRect(),pr=parent.getBoundingClientRect();
            for(const name of ['fontFamily','fontSize','fontWeight','fontStyle','lineHeight','letterSpacing','wordSpacing','textIndent','textAlign','textTransform','tabSize','paddingTop','paddingRight','paddingBottom','paddingLeft','borderTopWidth','borderRightWidth','borderBottomWidth','borderLeftWidth','borderRadius','wordBreak','overflowWrap'])layer.style[name]=style[name];
            layer.style.borderStyle='solid';layer.style.borderColor='transparent';
            layer.style.width=(textarea.clientWidth+parseFloat(style.borderLeftWidth)+parseFloat(style.borderRightWidth))+'px';
            layer.style.height=r.height+'px';
            layer.style.left=(r.left-pr.left-parent.clientLeft+parent.scrollLeft)+'px';
            layer.style.top=(r.top-pr.top-parent.clientTop+parent.scrollTop)+'px';
            layer.style.whiteSpace=textarea.wrap==='off'?'pre':'pre-wrap';
            layer.style.overflowWrap=textarea.wrap==='off'?'normal':'break-word';
            layer.style.display=range&&r.width&&r.height?'block':'none';
            layer.scrollTop=textarea.scrollTop;layer.scrollLeft=textarea.scrollLeft;
        }
        function show(start,end,jump=true) {
            range=start>=0&&end>start?[start,end]:null;
            layer.replaceChildren();mark=null;
            if(range){
                layer.append(document.createTextNode(textarea.value.slice(0,start)));
                mark=document.createElement('span');
                mark.style.cssText='color:transparent;background:rgba(40,170,220,.36);font:inherit;letter-spacing:inherit;';
                mark.textContent=textarea.value.slice(start,end);layer.append(mark,document.createTextNode(textarea.value.slice(end)+'\n'));
            }
            layout();
            if(mark&&jump){
                const mr=mark.getBoundingClientRect(),lr=layer.getBoundingClientRect();
                const y=mr.top-lr.top+layer.scrollTop;
                textarea.scrollTop=Math.max(0,y-textarea.clientHeight*.4);
                if(textarea.wrap==='off')textarea.scrollLeft=Math.max(0,mr.left-lr.left+layer.scrollLeft-textarea.clientWidth*.3);
                layout();
            }
        }
        textarea.addEventListener('scroll',layout,{passive:true});
        textarea.addEventListener('input',()=>show(-1,-1,false));
        if(typeof ResizeObserver!=='undefined')new ResizeObserver(layout).observe(textarea);
        window.addEventListener('resize',layout,{passive:true});
        const state={show,layout};searchLayers.set(textarea,state);return state;
    }
    function showSearch(textarea,start,end){searchLayer(textarea).show(start,end);}
    function refreshSearch(textarea){searchLayers.get(textarea)?.layout();}
    window.CssEditorExpansion={attach,close,showSearch,refreshSearch};
})();
