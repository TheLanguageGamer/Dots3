#include "Engine.h"
#include <random>

std::random_device rd;
std::mt19937 rng(rd()); 

struct ConnectingTiles : Screen
{
	std::shared_ptr<FilledRectangleComponent> background;
	std::shared_ptr<ComponentGrid> board;

	ConnectingTiles()
	: board(nullptr)
	{
		rootComponent = std::shared_ptr<struct Component>(new struct Component(entities));
		rootComponent->setRelativeSize(entities, Vector2(1.0f, 1.0f));

		background = std::shared_ptr<FilledRectangleComponent>(
			new FilledRectangleComponent(entities,0xFFFFFF00));

		background->setSizeMode(entities, Component::SizeMode_FixedAspectRatio);
		background->aspectRatio = 1.0f;
		background->setRelativeSize(entities, Vector2(1.0f, 1.0f));
		background->setOffsetSize(entities, Vector2(-100.0f, -100.0f));
		background->setRelativePosition(entities, Vector2(0.5f, 0.5f));
		background->setAnchorPoint(entities, Vector2(0.5f, 0.5f));
		background->setSizeMode(entities, Component::SizeMode_FixedAspectRatio);
		background->aspectRatio = 8.0/5.0;

		board = std::shared_ptr<ComponentGrid>(
			new ComponentGrid(
				entities,
				Vector2Int(8, 5),
				0.05,
				[this]()
				{
					auto container =  new RoundedRectangleComponent(
						entities,
						5.0f,
						0.0f,
						0x0,
						0x0000FFFF
					);
					return container;
				},
				[this]()
				{
					auto component = new RoundedRectangleComponent(
						entities,
						5.0f,
						0.0f,
						0x0f,
						0x226699FF
					);

					auto label = std::shared_ptr<struct Component>(
						new TextComponent(entities, "2", 0xFFFFFFFF, 18.0f));
					label->setRelativePosition(entities, Vector2(0.5f, 0.3f));
					label->setAnchorPoint(entities, Vector2(0.5f, 0.5f));
					label->setRelativeSize(entities, Vector2(0.7, 1.0));

					component->addChild(entities, label);
					return component;
				},
				[this](struct Component* cell, uint32_t row, uint32_t column, uint32_t state)
				{
					auto component = dynamic_cast<RoundedRectangleComponent*>(cell);
					
					char buff[16];
					sprintf(buff, "%u", state);
					auto label = std::dynamic_pointer_cast<TextComponent>(component->children[0]);
					label->setText(entities, buff);

				}
			)
		);
		board->setRelativeSize(entities, Vector2(1.0f, 1.0f));

		background->addChild(entities, board);
		rootComponent->addChild(entities, background);
	}
};

struct Mode1 : Screen
{
	Mode1()
	{
		entities.push_back(Entity::fillCircle(Vector2(50.0f, 50.0f), 30.0f, 0xAA88FFFF));
	}
};

std::function<void()> loop;
void main_loop() { loop(); }

int main()
{
	Game game;
	std::shared_ptr<Screen> mode0 = std::shared_ptr<Screen>(new ConnectingTiles());
	std::shared_ptr<Screen> mode1 = std::shared_ptr<Screen>(new Mode1());
	game.setScreen(mode1);

	int32_t mode = 0;
	loop = [&]
	{
		int32_t newMode = Engine_GetMode();
		if (newMode != mode)
		{
			printf("New mode: %d\n", newMode);
			mode = newMode;
			switch (mode)
			{
				case 0:
				{
					game.setScreen(mode0);
					break;
				}
				case 1:
				{
					game.setScreen(mode1);
					break;
				}
			}
		}
		game.loop();
	};

	emscripten_set_main_loop(main_loop, 0, true);

	return 1;
}