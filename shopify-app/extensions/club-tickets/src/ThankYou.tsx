import '@shopify/ui-extensions/preact';
import {render} from 'preact';
import {useEffect, useState} from 'preact/hooks';

const API = 'https://club.zero1soda.com/api/thank-you/tickets';
const RETRY_MS = 2000;
const MAX_TRIES = 15;

type Ticket = {
  code: string;
  event: string;
  index: number;
  total: number;
  checkinUrl: string;
  ticketUrl: string;
};

type State = {
  status: 'loading' | 'ready' | 'none' | 'unavailable';
  tickets: Ticket[];
};

export default function extension() {
  render(<Extension />, document.body);
}

function Extension() {
  const order = shopify.orderConfirmation.value?.order;
  const checkoutToken = shopify.checkoutToken.value;
  const [state, setState] = useState<State>({status: 'loading', tickets: []});

  useEffect(() => {
    if (!order?.id || !checkoutToken) {
      setState({status: 'unavailable', tickets: []});
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function load(attempt: number) {
      try {
        const token = await shopify.sessionToken.get();
        const response = await fetch(API, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({orderId: order.id, checkoutToken}),
        });
        const data: {status: string; tickets?: Ticket[]} = await response.json();
        if (cancelled) return;

        if (data.status === 'ready') {
          const tickets = data.tickets ?? [];
          setState({status: tickets.length ? 'ready' : 'none', tickets});
          return;
        }
        if (data.status !== 'pending' && data.status !== 'unavailable') {
          setState({status: 'unavailable', tickets: []});
          return;
        }
      } catch {
        if (cancelled) return;
      }

      if (attempt + 1 >= MAX_TRIES) {
        setState({status: 'unavailable', tickets: []});
        return;
      }
      timer = setTimeout(() => load(attempt + 1), RETRY_MS);
    }

    load(0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [order?.id, checkoutToken]);

  if (state.status === 'none') return null;

  if (state.status === 'loading') {
    return (
      <s-section heading="Your tickets">
        <s-stack direction="inline" gap="base" alignItems="center">
          <s-spinner size="base"></s-spinner>
          <s-text>Preparing your tickets…</s-text>
        </s-stack>
      </s-section>
    );
  }

  if (state.status === 'unavailable') {
    return (
      <s-banner heading="Your tickets" tone="info">
        Your ticket QR codes are in your order confirmation email.
      </s-banner>
    );
  }

  return (
    <s-section heading="Your tickets">
      <s-stack gap="large">
        <s-text>Show each code at the door. Every ticket is scanned once.</s-text>
        {state.tickets.map((ticket) => (
          <s-stack key={ticket.code} gap="small-200" alignItems="center">
            <s-text type="strong">{ticket.event}</s-text>
            <s-qr-code
              content={ticket.checkinUrl}
              accessibilityLabel={`Ticket ${ticket.index} of ${ticket.total} for ${ticket.event}`}
            ></s-qr-code>
            <s-text>
              Ticket {ticket.index} of {ticket.total} · Code {ticket.code}
            </s-text>
            <s-link href={ticket.ticketUrl} target="_blank">
              Open this ticket
            </s-link>
          </s-stack>
        ))}
      </s-stack>
    </s-section>
  );
}
