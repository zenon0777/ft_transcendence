import { ConnectedSocket, MessageBody, OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { ChannelService } from '../channel/channel.service';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../../user/user.service';
import { creatChannelDto } from '../dto/creat-channel.dto';
import { BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { DmOutils } from '../dm/dm.outils';
import { creatMessageCh } from '../dto/creat-message.dto';
import { ChannelOutils } from '../channel/outils';
import { DmService } from '../dm/dm.service';
import { joinChannelDto, responseJoinChannelDto } from '../dto/joinChannelDto.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { sendMessageDmDto } from '../dto/sendMessage.dto';
import { changeNameDto, changeOwnerDto, changePassDto, changeTypeDto, changepicDto } from '../dto/changePramCH.dto';
import { threadId } from 'worker_threads';
import { banUserDto, kickUserDto, muteUserDto } from '../dto/blacklist.dto';


@WebSocketGateway({ 
	namespace: 'chatGateway', cors: {
	origin: process.env.FrontendHost,
	allowedHeaders: ['token'],
	credentials: true
} })

export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {

	constructor(
		private jwtService: JwtService,
		private userService: UserService,
		private channelService: ChannelService,
		private Outils: ChannelOutils,
		private DmOutils: DmOutils,
		private DmService: DmService,
		private readonly prisma: PrismaService,
	){}

	@WebSocketServer()
	server: Server;

	private readonly usersSockets: {userId: string, socket: any}[] = [];

	async handleConnection(@ConnectedSocket() client: Socket)
	{
		try
		{
			const token: string = client.handshake.headers.token as string;
			const payload = await this.jwtService.verifyAsync(token, { secret: process.env.jwtsecret })
			const user = await this.userService.findOneById(payload.sub);
			client.data.user = user;
			console.log(`------ coonect: ${user.nickname} ------`);
			this.usersSockets.push({userId: user.id, socket: client});
			client.emit('userConnection', {msg: `${client.data.user.nickname} is connected`});
			await this.channelService.pushMutedUsers();
		}
		catch (error)
		{
			console.error(error.message);
			client.disconnect();
		}
	}
		
	async handleDisconnect(@ConnectedSocket() client: Socket)
	{
		try
		{
			console.log(`------ User disconnect ------`);
			client.disconnect();
		}
		catch (error)
		{
			console.error(error.message);
		}
	}

	@SubscribeMessage('creatChannel')
	async	creatChannel(@MessageBody() data: creatChannelDto, @ConnectedSocket() client: Socket)
	{
		try
		{
			// add a field for the picture of channel
			await  this.DmOutils.validateDtoData(data, creatChannelDto);
			const owner = client.data.user.nickname;
			data.type = data.type.toUpperCase();
			if (data.name.length > 10) {
				throw new BadRequestException(`The name of channel should be less than or equal 10`);
			}
			if (data.type !== 'PROTECTED' && data.type !== 'PUBLIC' && data.type !== 'PRIVATE') {
				throw new BadRequestException(`Channel type ${data.type} unknow.`);
			}
			const newChannel = await this.channelService.creatChannel(data, owner);
			console.log(`${owner} creat new channel: `, newChannel);
			client.emit('channelCreated', newChannel);
		}
		catch (error)
		{
			// console.error('Error creating channel:', error.message);
			client.emit('Failed', { error: 'Failed to create a new channel.' });
		}
	}

	@SubscribeMessage('joinChannel')
	async	AddUser2Channel(@MessageBody() data: joinChannelDto,  @ConnectedSocket() client: Socket)
	{
		try
		{
			await  this.DmOutils.validateDtoData(data, joinChannelDto);
			const {channelName, password} = data;
			const user = client.data.user.nickname;
			const updateChannelUsers = await this.channelService.joinChannel(channelName, user, password);
			if (updateChannelUsers[0] === 'PRIVATE') {
				this.server.to(updateChannelUsers[1]).emit('joinChannelRequest', { channelName, user });
				return;
			}
			else {
				client.emit('userAdded2Channel', updateChannelUsers);
			}
		}
		catch (error)
		{
			client.emit('Failed', error.message);
		}
	}

	@SubscribeMessage('responseJoinChannel')
	async	ResponseJoinChannel(@MessageBody() data: responseJoinChannelDto,  @ConnectedSocket() client: Socket)
	{
		try
		{
			await  this.DmOutils.validateDtoData(data, responseJoinChannelDto);
			const {channelName, user, value} = data;
			if (value) {
				await this.prisma.channel.update({
					where: { name: channelName },
					data: {
						users: {
							connect: { nickname: user },
						},
					},
		
				});
				client.emit('userAdded2Channel', `Your request to join channel ${channelName} accepted`);
			}
			else {
				client.emit('userAdded2Channel', `Your request to join channel ${channelName} rejected`);
			}
		}
		catch (error)
		{
			client.emit('Failed', error.message);
		}
	}

	@SubscribeMessage('sendMessageCH')
	async	handleSendMessageCh(@MessageBody() data: creatMessageCh, @ConnectedSocket() client: Socket)
	{
		try
		{
			await  this.DmOutils.validateDtoData(data, creatMessageCh);
			const {channelId, content} = data;
			const isUserInBlacklist = await this.Outils.isUserInBlacklist(channelId, client.data.user.nickname);
			if (isUserInBlacklist) {
				throw new UnauthorizedException(`you are not allowed to send message`);
			}
			// const channels = await this.channelService.getUserChannels(client.data.user.nickname);
			const message = await this.channelService.creatMessageChannel(channelId, client.data.user.nickname, content);
			const Id = await this.Outils.getChannelIdByName(channelId);
			// for (const channel of channels) {
			// 	// check blocked and bane users and don't join theme into the room
			// 	client.join(channel.id);
			// }
			// const channelUsers = await this.channelService.getChannelUsers(channelId);
			// for (const channel of channels) {
			// 	// check blocked and bane users and don't join theme into the room
			// 	client.leave(channel.id);
			// }
			for (const user  of this.usersSockets) {
				user.socket.join(Id);
			}
			this.server.to(Id).emit('sendMessageDone', message);
			for (const user  of this.usersSockets) {
				user.socket.leave(Id);
			}
		}
		catch (error)
		{
			console.error('message faild channel');
			client.emit('Faild', error.message);
		}
	}

	@SubscribeMessage('sendMessageDM')
	async	handleSendMessageDm(@MessageBody() data: sendMessageDmDto, @ConnectedSocket() client: Socket)
	{
		try
		{
			await  this.DmOutils.validateDtoData(data, sendMessageDmDto);
			// check if i'm blocked by this users
			let dmId = '';
			// console.log('receiver: ', data[1]);
			const {receiver, content} = data;
			const user2Id = await this.Outils.getUserIdByName(receiver);
			dmId = await this.DmOutils.getDmIdby2User(client.data.user.id, user2Id);
			if (dmId === null) {
				await this.DmService.creatDMchat(client.data.user.id, user2Id);
				dmId = await this.DmOutils.getDmIdby2User(client.data.user.id, user2Id);
			}
			const message = await this.DmService.creatMessageDm(dmId, client.data.user.nickname, content);
			const receiverSocket = this.usersSockets.find(user => user.userId === user2Id);
			if (receiverSocket) {
				client.join(dmId);
				receiverSocket.socket.join(dmId);
				this.server.to(dmId).emit('sendMessageDone', message);
				client.leave(dmId);
				receiverSocket.socket.leave(dmId);
			}
		}
		catch (error)
		{
			console.error('message faild dm', error.message);
			client.emit('Faild', 'message faild to send dm');
		}
	}
	

	
	@SubscribeMessage('leaveChannel')
	async	handleLeaveChannel(@MessageBody() channelName: string, @ConnectedSocket() client: Socket)
	{
		try
		{
			console.log('channel name befor: ', channelName);
			console.log('username befor: ', client.data.user.nickname);
			await this.channelService.leaveChannel(channelName, client.data.user.nickname);
			client.emit('leaveChannelDone', {msg: 'you are now out of this channel'});
		}
		catch(error)
		{
			if (error instanceof NotFoundException) {
				console.error('Resource not found.');
			}
			else if (error instanceof BadRequestException) {
				console.error('owner should set another owner before leave channel');
            }
			else if (error instanceof UnauthorizedException) {
				console.error('Unauthorized access.');
            }
			else {
				console.error('An unexpected error occurred:', error.message);
            }
			client.emit('Failed', { error: 'Failed to leave channel.' });
		}
	}

	//---------- blacklist ----------////---------- blacklist ----------////---------- blacklist ----------//
	@SubscribeMessage('kickUser')
	async	KickUser(@MessageBody() data: kickUserDto, @ConnectedSocket() client: Socket)
	{
		try
		{
			await  this.DmOutils.validateDtoData(data, kickUserDto);
			const {channelName, user2kick} = data;
			const admin = client.data.user.nickname;
			await this.channelService.kickUser(channelName, admin, user2kick);
			client.emit('kickDone', {msg: `${user2kick} is kicked.`});
			// emit an notification to the user kicked and to all chanel users
		}
		catch(error)
		{
			console.error('Error<kickUser>: ', error.message);
			client.emit('Failed', { error: `Failed to kick user.`});
		}
	}
	
	@SubscribeMessage('banUser')
	async	BanUser(@MessageBody() data: banUserDto, @ConnectedSocket() client: Socket)
	{
		try
		{
			await  this.DmOutils.validateDtoData(data, banUserDto);
			const {channelName, user2ban} = data;
			const admin = client.data.user.nickname;
			await this.channelService.banUser(channelName, admin, user2ban);
			client.emit('banDone', {msg: `${user2ban} is baned.`});
			// emit an notification to the user baned and to all chanel users
		}
		catch(error)
		{
			console.error('Error<banUser>: ', error.message);
			client.emit('Failed', { error: 'Failed to ban user.' });
		}
	}
	
	@SubscribeMessage('muteUser')
	async	MuteUser(@MessageBody() data: muteUserDto, @ConnectedSocket() client: Socket)
	{
		try
		{
			await  this.DmOutils.validateDtoData(data, muteUserDto);
			const {channelName, user2mute, expirationTime} = data;
			const admin = client.data.user.nickname;
			await this.channelService.muteUser(channelName, admin, user2mute, expirationTime);
			client.emit('muteDone', {msg: `${user2mute} is muteed.`});
			// emit an notification to the user muted and to all chanel users
		}
		catch(error)
		{
			console.error('Error<muteUser>: ', error.message);
			client.emit('Failed', { error: 'Failed to mute user.' });
		}
	}
	//---------- blacklist ----------////---------- blacklist ----------////---------- blacklist ----------//

	//--------- changeParm ----------////--------- changeParm ----------////--------- changeParm ----------//
	@SubscribeMessage('changeOwnerCH')
	async	ChangeChannelOwner(@MessageBody() data: changeOwnerDto, @ConnectedSocket() client: Socket)
	{
		try
		{
			await  this.DmOutils.validateDtoData(data, changeOwnerDto);
			const {channelName, newOwner} = data;
			const owner = client.data.user.nickname;
			await this.channelService.changeOwnerOfChannel(channelName, owner, newOwner);
			// emit notification to inform user he is the new owner inside channel | serverside
		}
		catch(error)
		{
			console.error('Error<changeOwnerCH>: ', error.message);
			client.emit('Failed', { error: 'Failed to change channel owner.' });
		}
	}

	@SubscribeMessage('changeTypeCH')
	async	ChangeChannelType(@MessageBody() data: changeTypeDto, @ConnectedSocket() client: Socket)
	{
		try
		{
			await  this.DmOutils.validateDtoData(data, changeTypeDto);
			const {channelName, newType, password} = data;
			const owner = client.data.user.nickname;
			await this.channelService.changeChannelType(channelName, owner, newType, password);
			// emit notification inside channel : `New type is seted to: ${newType}.` | serverside
		}
		catch (error)
		{
			console.error('Error<changeTypeCH>: ', error.message);
			client.emit('Failed', `Failed to change channel type.`);
		}
	}
	
	@SubscribeMessage('changeNameCH')
	async	ChangeChannelName(@MessageBody() data: changeNameDto, @ConnectedSocket() client: Socket)
	{
		try
		{
			await  this.DmOutils.validateDtoData(data, changeNameDto);
			const {channelName, newName} = data;
			const owner = client.data.user.nickname;
			await this.channelService.changeChannelName(channelName, owner, newName);
			// emit notification inside channel : `New channel name seted.` | serverside
		}
		catch (error)
		{
			console.error('Error<changeNameCH>: ', error.message);
			client.emit('Failed', `Failed to change chnnel name.`);
		}
	}
	
	@SubscribeMessage('changePassCH')
	async	ChangeChannelPass(@MessageBody() data: changePassDto, @ConnectedSocket() client: Socket)
	{
		try
		{
			await  this.DmOutils.validateDtoData(data, changePassDto);
			const {channelName, newPassword} = data;
			const owner = client.data.user.nickname;
			await this.channelService.changeChannelPass(channelName, owner, newPassword);
			// emit notification inside channel : `New password is seted.` | serverside
		}
		catch (error)
		{
			console.error('Error<changePassCH>: ', error.message);
			client.emit('Failed', `Failed to change channel password.`);
		}
	}

	@SubscribeMessage('changePicCH')
	async	ChangeChannelPicture(@MessageBody() data: changepicDto, @ConnectedSocket() client: Socket)
	{
		try
		{
			await  this.DmOutils.validateDtoData(data, changepicDto);
			const {channelName, newPicture} = data;
			const owner = client.data.user.nickname;
			await this.channelService.changeChannelPicture(channelName, newPicture, owner);
			// emit notification inside channel : 'New picture is seted.' | serverside
		}
		catch (error)
		{
			console.error('Error<changePicCH>: ', error.message);
			client.emit('Failed', 'Faild to change picture.');
		} 
	}
		//--------- changeParm ----------////--------- changeParm ----------////--------- changeParm ----------//
	
	//add event to get channel users and admins and owner.
	@SubscribeMessage('getChSidebar')
	async	getChannelSidebar(@MessageBody() channelName: string, @ConnectedSocket() client: Socket)
	{
		try
		{
			// const channelName = data;
		}
		catch
		{

		}
	}

	@SubscribeMessage('getUserChannels')
	async	GetUserChannels(@ConnectedSocket() client: Socket)
	{
		try
		{
			const user = client.data.user.nickname;
			const userChannels = await this.channelService.getUserChannels(user);
			client.emit('UserChannels', userChannels);
			// return obj hold channels names and the last msg and the picture
		}
		catch(error)
		{
			console.error('Error<getUserChannels>: ', error.message);
			client.emit('Failed', { error: 'Failed to get user channels.' });
		}
	}

	@SubscribeMessage('getUserDm')
	async	GetUserDm(@ConnectedSocket() client: Socket)
	{
		try
		{
			const user = client.data.user.nickname;
			// const userDms = await this.DmService.(client.data.user.nickname);
			// client.emit('UserDms', userDms);
			// rteurn obj hold receiver name the last message and the picture of receiver
		}
		catch(error)
		{
			console.error('Error<getUserDms>: ', error.message);
			client.emit('Failed', { error: 'Failed to get user direct messages.' });
		}
	}

	// add event for search for a all channels by the user
	// search for dm for all user friends
	// add event to search for a user in the channel users
}
