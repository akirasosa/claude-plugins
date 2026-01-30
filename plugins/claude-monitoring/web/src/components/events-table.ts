// Events table Lit component

import { html, LitElement, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { repeat } from "lit/directives/repeat.js";
import { getReadStatus } from "../storage";
import type { EventResponse } from "../types";
import "./event-row";

interface EventWithReadStatus {
  event: EventResponse;
  isRead: boolean;
}

@customElement("events-table")
export class EventsTable extends LitElement {
  @property({ type: Array }) events: EventResponse[] = [];
  @state() private eventsWithStatus: EventWithReadStatus[] = [];

  // Use light DOM for Tailwind CSS compatibility
  protected createRenderRoot() {
    return this;
  }

  protected async willUpdate(changedProperties: Map<string, unknown>) {
    if (changedProperties.has("events")) {
      await this.updateReadStatuses();
    }
  }

  private async updateReadStatuses() {
    const eventsWithStatus = await Promise.all(
      this.events.map(async (event) => {
        const isRead = await getReadStatus(event.event_id);
        return { event, isRead };
      }),
    );
    this.eventsWithStatus = eventsWithStatus;
  }

  render() {
    if (this.eventsWithStatus.length === 0) {
      return nothing;
    }

    return html`
      ${repeat(
        this.eventsWithStatus,
        (item) => item.event.event_id,
        (item) => html`
          <event-row .event="${item.event}" .isRead="${item.isRead}"></event-row>
        `,
      )}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "events-table": EventsTable;
  }
}
