'use client'
import React from 'react'
import { ArrowUp } from 'lucide-react'

export default function BackToTop(){
 const [visible,setVisible]=React.useState(false)
 React.useEffect(()=>{
  let previous = false
  const onScroll=()=>{
   const next = window.scrollY > 500
   if (next !== previous) { previous = next; setVisible(next) }
  }
  onScroll(); window.addEventListener('scroll',onScroll,{passive:true})
  return()=>window.removeEventListener('scroll',onScroll)
 },[])
 const goTop=()=>window.scrollTo({top:0,behavior:'smooth'})
 return <button type="button" className={`back-to-top ${visible?'is-visible':''}`} onClick={goTop} aria-label="Back to top" title="Back to top"><ArrowUp size={22} strokeWidth={3.25}/></button>
}
