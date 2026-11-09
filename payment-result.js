"use strict";
document.addEventListener("DOMContentLoaded", async () => {
  const $=id=>document.getElementById(id);
  const title=$("result-heading"), message=$("result-message"), details=$("result-details");
  const box=$("download-box"), link=$("photo-download-link"), note=$("environment-notice");
  const query=new URLSearchParams(location.search);
  if(query.has("cancelled")){
    title.textContent="Checkout cancelled.";
    message.textContent="Your payment was not completed. Feel free to return and try again.";
    return;
  }
  const id=query.get("session_id");
  if(!id || !/^cs_(?:test|live)_[A-Za-z0-9_]{6,160}$/.test(id)){
    title.textContent="Order not found.";
    message.textContent="Open a photograph or the studio form to begin checkout.";
    return;
  }
  try{
    const response=await fetch(`/api/payments/status?session_id=${encodeURIComponent(id)}`,{cache:"no-store",referrerPolicy:"no-referrer"});
    const status=await response.json();
    if(!response.ok)throw new Error(status.error||"We could not verify your order.");
    const sandbox=status.mode==="test";
    note.textContent=sandbox?"STRIPE SANDBOX — This payment was a test. No real money moved.":
      "Payment processed securely by Stripe. Photograph-sale fundraising and studio support are separate purposes.";
    if(!status.paid){
      title.textContent="Payment pending.";
      message.textContent="Stripe has not confirmed this payment. Check again shortly or contact Frankie if you were charged.";
      return;
    }
    title.textContent=sandbox?"Test payment confirmed.":"Thank you for your order.";
    details.textContent=new Intl.NumberFormat("en-GB",{style:"currency",currency:"GBP"}).format(status.amountPence/100);
    if(status.purpose==="photo_copy"){
      if(status.downloadUrl){
        title.textContent=sandbox?"Test download ready.":"Your photograph is ready.";
        message.textContent=sandbox?"Stripe verified your test purchase. Download the sample-delivery original below.":
          "Your payment has been confirmed. Your private photo download is ready below.";
        link.href=status.downloadUrl;
        box.hidden=false;
      } else {
        message.textContent="Your purchase is confirmed, but the private original is not available for download right now. Please contact Frankie and provide your Stripe receipt.";
      }
    }else if(status.purpose==="studio_support"){
      message.textContent=sandbox?"Your studio support payment was simulated successfully.":
        "Thank you for supporting Frankie's proposed photography studio. This is separate from Cancer Research UK photograph sales.";
    }else if(status.purpose==="photo_rights"){
      message.textContent="This is a sandbox rights demonstration. Copyright is not transferred. A signed agreement is required for real rights purchases.";
    } else message.textContent="Stripe confirmed the payment.";
  }catch(error){
    title.textContent="Unable to verify payment.";
    message.textContent=error.message;
  }
});
