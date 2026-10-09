UPDATE public.site_config
SET value = to_jsonb((value#>>'{}') || '<h2>Gift Vouchers</h2>
<p><strong>Purchase.</strong> Gift vouchers are bought online at fluffandscruff.co.uk/vouchers and paid in full by card. A voucher is only created once payment has been received. Vouchers are digital and are sent by email and/or text message to the buyer or to the person they choose.</p>
<p><strong>Validity.</strong> Every voucher is valid for 12 months from the date of purchase. Expired vouchers cannot be extended, exchanged or refunded.</p>
<p><strong>Single use.</strong> A voucher can be used once, on one appointment. Its value is taken off the price of that appointment (deposit first, then the balance). If the appointment costs less than the voucher, the unused amount is forfeited and no change, credit or cash is given.</p>
<p><strong>Paying the difference.</strong> If the appointment costs more than the voucher, the remaining deposit and balance must be paid by card in line with our usual booking terms.</p>
<p><strong>No cash value.</strong> Vouchers have no cash value, cannot be exchanged for cash and cannot be refunded once purchased.</p>
<p><strong>Seasonal vouchers.</strong> Seasonal vouchers (for example Halloween or Christmas) are only on sale during that season. A seasonal package voucher is priced at the groom price for the chosen service and breed plus the seasonal extra; its value can be used on any groom while it is valid.</p>
<p><strong>Redeeming.</strong> Vouchers can be redeemed when booking online (by entering the code at payment), over the phone, or in the salon. Please keep your code safe — anyone with the code can use it. We cannot replace a voucher that has already been used by someone else.</p>
<p><strong>Cancellations.</strong> If an appointment booked with a voucher is cancelled more than 48 hours before the appointment, the voucher is re-activated for the rest of its validity. If it is cancelled with less than 48 hours'' notice, or the appointment is missed, the voucher is treated as used. Voucher amounts are never refunded as cash.</p>
<p><strong>Lost vouchers and corrections.</strong> If a voucher has not been received or the email/phone number was entered incorrectly, contact us and we can correct the details and re-send any unused voucher.</p>
<p><strong>Privacy.</strong> When a voucher is used, the buyer may receive a short message saying their gift has been used. We never share appointment dates, times or other personal details with the buyer.</p>'),
updated_at = now()
WHERE key = 'terms_and_conditions'
  AND position('<h2>Gift Vouchers</h2>' in value#>>'{}') = 0;