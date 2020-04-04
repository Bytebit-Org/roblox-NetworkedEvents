import { RunService } from "@rbxts/services";
import { NetworkedEventCallback } from "../Types/NetworkedEventCallback";
import { ArgumentsTupleCheck } from "../Types/ArgumentsTupleCheck";
import { IServerSignalListener } from "../Interfaces/IServerSignalListener";
import { NetworkedSignalDescription } from "../Types/NetworkedSignalDescription";
import { waitForNamedChildWhichIsA } from "../Functions/WaitForNamedChildWhichIsA";

const IS_STUDIO = RunService.IsStudio();

if (IS_STUDIO && RunService.IsServer()) {
	error("Attempt to require ServerSignalListener from server");
}

export class ServerSignalListener<T extends NetworkedEventCallback> implements IServerSignalListener<T> {
	private readonly tChecks: ArgumentsTupleCheck<T>;
	private readonly shouldCheckInboundArgumentTypes: boolean;

	private remoteEvent?: RemoteEvent;

	/**
	 * Use create method instead!
	 */
	private constructor(
		parent: Instance,
		description: NetworkedSignalDescription<T>,
		shouldCheckInboundArgumentTypes?: boolean,
	) {
		this.tChecks = description.tChecks;
		this.shouldCheckInboundArgumentTypes =
			shouldCheckInboundArgumentTypes !== undefined ? shouldCheckInboundArgumentTypes : false;

		this.remoteEvent = waitForNamedChildWhichIsA(parent, description.name, "RemoteEvent");
	}

	/**
	 * Instantiates a new ServerSignalListener
	 * @param parent The parent Instance holding the networked event
	 * @param description The description for the networked event
	 * @param shouldCheckInboundArgumentTypes An optional parameter that describes whether all arguments should be type checked. Defaults to false.
	 */
	public static create<T extends NetworkedEventCallback>(
		parent: Instance,
		description: NetworkedSignalDescription<T>,
		shouldCheckInboundArgumentTypes?: boolean,
	): IServerSignalListener<T> {
		return new ServerSignalListener(parent, description, shouldCheckInboundArgumentTypes);
	}

	public connect(callback: T): RBXScriptConnection {
		if (this.remoteEvent === undefined) {
			throw `Cannot connect to destroyed ServerSignalListener`;
		}

		return this.remoteEvent.OnClientEvent.Connect((...args: Array<unknown>) => {
			if (this.areArgumentsValid(args)) {
				callback(...args);
			}
		});
	}

	public destroy() {
		this.remoteEvent = undefined;
	}

	public wait(): FunctionArguments<T> {
		if (this.remoteEvent === undefined) {
			throw `Cannot wait for destroyed ServerSignalListener`;
		}

		while (true) {
			const waitResults = this.remoteEvent.OnClientEvent.Wait();
			if (this.areArgumentsValid(waitResults)) {
				return waitResults;
			}
		}
	}

	private areArgumentsValid(args: Array<unknown>): args is FunctionArguments<T> {
		// Yes, this is basically just a type assertion for TypeScript if shouldDoTypeCheckOnArguments() returns false
		// That's okay - this is client side and is checking arguments from the server, so it should be safe
		if (!this.shouldDoTypeCheckOnArguments() || this.doArgumentsSatisfyChecks(args)) {
			return true;
		}

		if (IS_STUDIO) {
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			error(`Invalid arguments passed to server signal ${this.remoteEvent!.Name}`);
		}

		return false;
	}

	private shouldDoTypeCheckOnArguments() {
		return !IS_STUDIO && !this.shouldCheckInboundArgumentTypes;
	}

	private doArgumentsSatisfyChecks(args: Array<unknown>): args is FunctionArguments<T> {
		if (args.size() !== this.tChecks.size()) {
			if (IS_STUDIO) {
				// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
				error(`Invalid number of arguments passed to client signal ${this.remoteEvent!.Name}`);
			}
			return false;
		}

		for (let i = 0; i < args.size(); i++) {
			if (!this.tChecks[i](args[i])) {
				if (IS_STUDIO) {
					error(
						`Argument ${i} does not pass type check for client signal ${
							// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
							this.remoteEvent!.Name
						} - given value: ${args[i]}`,
					);
				}
				return false;
			}
		}

		return true;
	}
}