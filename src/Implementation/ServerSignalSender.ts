import { Players, RunService } from "@rbxts/services";
import { NetworkedSignalCallback } from "../types/NetworkedSignalCallback";
import { IServerSignalSender } from "../interfaces/IServerSignalSender";
import { NetworkedSignalDescription } from "../types/NetworkedSignalDescription";
import { InstanceFactory } from "../factories/InstanceFactory";
import { GetNetworkedSignalCallbackType } from "../types/GetNetworkedSignalCallbackType";

export class ServerSignalSender<T extends NetworkedSignalCallback | NetworkedSignalDescription = () => void>
	implements IServerSignalSender<T> {
	private readonly remoteEvent: RemoteEvent;

	/**
	 * Use create method instead!
	 */
	private constructor(
		description: NetworkedSignalDescription<GetNetworkedSignalCallbackType<T>>,
		instanceFactory: InstanceFactory,
		parent: Instance,
	) {
		if (!RunService.IsServer()) {
			throw "Attempt to create a ServerSignalSender from client";
		}

		const remoteEventCandidate = parent.FindFirstChild(description.name);
		if (remoteEventCandidate !== undefined && remoteEventCandidate.IsA("RemoteEvent")) {
			this.remoteEvent = remoteEventCandidate;
		} else {
			const newRemoteEvent = instanceFactory.createInstance("RemoteEvent");
			newRemoteEvent.Name = description.name;
			newRemoteEvent.Parent = parent;

			this.remoteEvent = newRemoteEvent;
		}
	}

	/**
	 * Instantiates a new ServerSignalSender
	 * @param parent The parent Instance holding the networked event
	 * @param description The description for the networked event
	 */
	public static create<T extends NetworkedSignalCallback | NetworkedSignalDescription>(
		parent: Instance,
		description: NetworkedSignalDescription<GetNetworkedSignalCallbackType<T>>,
	): IServerSignalSender<T> {
		return new ServerSignalSender(description, new InstanceFactory(), parent);
	}

	public destroy() {
		this.remoteEvent.Destroy();
	}

	public fireToPlayer(player: Player, ...args: FunctionArguments<GetNetworkedSignalCallbackType<T>>) {
		this.remoteEvent.FireClient(player, ...args);
	}

	public fireToAll(...args: FunctionArguments<GetNetworkedSignalCallbackType<T>>) {
		this.remoteEvent.FireAllClients(...args);
	}

	public fireToWhitelist(
		playersWhitelist: ReadonlyArray<Player>,
		...args: FunctionArguments<GetNetworkedSignalCallbackType<T>>
	) {
		playersWhitelist.forEach(player => this.remoteEvent.FireClient(player, ...args));
	}

	public fireToOthers(
		playersBlacklist: ReadonlyArray<Player>,
		...args: FunctionArguments<GetNetworkedSignalCallbackType<T>>
	) {
		const playersBlacklistSet = new Set(playersBlacklist);
		Players.GetPlayers()
			.filter(player => !playersBlacklistSet.has(player))
			.forEach(player => this.remoteEvent.FireClient(player, ...args));
	}
}
