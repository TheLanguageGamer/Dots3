#include "Engine.h"

struct TestPrimitives : Screen
{
	TestPrimitives()
	{
		printf("initializing TestPrimitives\n");
		entities.push_back(Entity::circle(Vector2(50.0f, 50.0f), 30.0f, 0xFF88AAFF));
		entities.push_back(Entity::rectangle(Vector2(150.0f, 50.0f), Vector2(40.0f, 80.0f), 0xBB88FFFF));
		//entities.push_back(Entity::circle(Vector2(50.0f, 150.0f), 2.0f, 0x999999FF));
		for (int32_t i = 1; i <= 5; ++i)
		{
			Entity textEntity = Entity::text(
				"Hello!",
				Vector2(50.0f, 120.0f + i*50.0f),
				i*10.0f,
				0xFFFFFFFF
			);
			printf("rectangle size: %4.2f x %4.2f\n", textEntity.coord3.x, textEntity.coord3.y);
			entities.push_back(Entity::rectangle(
				textEntity.coord1,
				textEntity.coord3,
				0xBB88FFFF
			));
			entities.push_back(textEntity);
		}

		entities.push_back(Entity::roundedRectangle(
			Vector2(250.0f, 50.0f),
			Vector2(100.0f, 200.0f),
			15.0f,
			5.0f,
			0xFFFFFFFF,
			0x55FFBBFF
		));
	}
};

struct TestTextLabel : Screen
{
	TestTextLabel()
	{
		printf("initializing TestTextLabel\n");
		entities.push_back(Entity::circle(Vector2(50.0f, 50.0f), 30.0f, 0x99FF99FF));
		rootComponent = std::shared_ptr<struct Component>(new RectangleComponent(entities, 0xFFFFFFFF));
		rootComponent->setRelativeSize(entities, Vector2(0.5f, 0.5f));
		rootComponent->setRelativePosition(entities, Vector2(0.5f, 0.5f));
		rootComponent->setAnchorPoint(entities, Vector2(0.5f, 0.5f));

		auto ulText = std::shared_ptr<struct Component>(new TextComponent(entities, "Hello World!", 0x0000FFFF, 20.0f));
		rootComponent->addChild(ulText);

		auto urText = std::shared_ptr<struct Component>(new TextComponent(entities, "Hello World!", 0x0000FFFF, 20.0f));
		urText->setRelativePosition(entities, Vector2(1.0f, 0.0f));
		urText->setAnchorPoint(entities, Vector2(1.0f, 0.0f));
		rootComponent->addChild(urText);

		auto blText = std::shared_ptr<struct Component>(new TextComponent(entities, "Hello World!", 0x0000FFFF, 20.0f));
		blText->setRelativePosition(entities, Vector2(0.0f, 1.0f));
		blText->setAnchorPoint(entities, Vector2(0.0f, 1.0f));
		rootComponent->addChild(blText);

		auto brText = std::shared_ptr<struct Component>(new TextComponent(entities, "Hello World!", 0x0000FFFF, 20.0f));
		brText->setRelativePosition(entities, Vector2(1.0f, 1.0f));
		brText->setAnchorPoint(entities, Vector2(1.0f, 1.0f));
		rootComponent->addChild(brText);

		auto cText = std::shared_ptr<struct Component>(new TextComponent(entities, "Hello World!", 0x0000FFFF, 20.0f));
		cText->setRelativePosition(entities, Vector2(0.5f, 0.5f));
		cText->setAnchorPoint(entities, Vector2(0.5f, 0.5f));
		rootComponent->addChild(cText);
	}
};

struct TestEntityGrid : Screen
{
	TestEntityGrid()
	{
		printf("initializing TestEntityGrid\n");
		entities.push_back(Entity::circle(Vector2(50.0f, 50.0f), 30.0f, 0x66AAFFFF));
		rootComponent = std::shared_ptr<struct Component>(new EntityGrid(
			entities,
			Vector2Int(20, 30)
		));
		rootComponent->sizeMode = Component::SizeMode_FixedAspectRatio;
		rootComponent->setRelativeSize(entities, Vector2(1.0f, 1.0f));
		rootComponent->setOffsetSize(entities, Vector2(-10.0f, -10.0f));
		rootComponent->setRelativePosition(entities, Vector2(0.5f, 0.5f));
		rootComponent->setAnchorPoint(entities, Vector2(0.5f, 0.5f));
	}
};

struct TestDraggable : Screen
{
	TestDraggable()
	{
		printf("initializing TestDraggable\n");
		entities.push_back(Entity::circle(Vector2(50.0f, 50.0f), 30.0f, 0xFF00FFFF));
		rootComponent = std::shared_ptr<struct Component>(new RectangleComponent(entities, 0xFFFFFFFF));
		rootComponent->setRelativePosition(entities, Vector2(0.5f, 0.5f));
		rootComponent->setAnchorPoint(entities, Vector2(0.5f, 0.5f));
		rootComponent->setOffsetSize(entities, Vector2(80.0f, 80.0f));
		rootComponent->isDraggable = true;
	}
};

std::function<void()> loop;
void main_loop() { loop(); }

int main()
{
	printf("jhelms\n");
	Game game;
	//game.entities.push_back(Entity::circle(Vector2(50.0f, 50.0f), 30.0f, 0xFF88AAFF));
	std::shared_ptr<Screen> testPrimitives = std::shared_ptr<Screen>(new TestPrimitives());
	std::shared_ptr<Screen> testTextLabel = std::shared_ptr<Screen> (new TestTextLabel());
	std::shared_ptr<Screen> testEntityGrid = std::shared_ptr<Screen> (new TestEntityGrid());
	std::shared_ptr<Screen> testDraggable = std::shared_ptr<Screen> (new TestDraggable());
	game.setScreen(testPrimitives);

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
					game.setScreen(testPrimitives);
					break;
				}
				case 1:
				{
					game.setScreen(testTextLabel);
					break;
				}
				case 2:
				{
					game.setScreen(testEntityGrid);
					break;
				}
				case 3:
				{
					game.setScreen(testDraggable);
					break;
				}
			}
		}
		game.loop();
	};

	emscripten_set_main_loop(main_loop, 0, true);

	return 1;
}